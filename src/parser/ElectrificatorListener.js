import { Component, ComponentAttribute } from 'leto-modelizer-plugin-core';

/**
 * ElectrificatorListener for json files
 */
class ElectrificatorListener {
  /**
   * Parsed components.
   * @type {Component[]}
   */
  components = [];

  /**
   * Container stack.
   * @type {Component[]}
   */
  containerStack = [];

  /**
   * Default constructor.
   * @param {FileInformation} fileInformation - File information.
   * @param {ComponentDefinition[]} definitions - All component definitions.
   */
  constructor(fileInformation, definitions) {
    /**
     * File information.
     * @type {FileInformation}
     */
    this.fileInformation = fileInformation;
    /**
     * Array of component definitions.
     * @type {ComponentDefinition[]}
     */
    this.definitions = definitions;
  }

  /**
   * Create component except workflow type component.
   * @param {string} id - Component id.
   * @param {ComponentDefinition} definition -  Component definition.
   * @param {ComponentAttribute[]} [attributes] - Component attribute.
   * @returns {Component} Created component with default attribute(s) and properties.
   */
  createComponent(id, definition, attributes) {
    return new Component({
      id,
      definition,
      path: this.fileInformation.path,
      attributes,
    });
  }

  /**
   * Restore attributes from json file. If attribute is not defined in component definition, it will
   * be added as a string attribute.
   * @param {object} attributes - Attributes from json file.
   * @param {ComponentDefinition} componentDefinition - Component definition.
   * @returns {ComponentAttribute[]} Restored attributes.
   */
  restoreAttributes(attributes, componentDefinition) {
    return Object.entries(attributes).reduce((acc, [key, value]) => {
      const attributeDefinition = componentDefinition.definedAttributes.find(
        (attribute) => attribute.name === key,
      );
      acc.push(new ComponentAttribute({
        name: key,
        value,
        type: 'string',
        definition: attributeDefinition || null,
      }));
      return acc;
    }, []);
  }

  /**
   * Restore ports from json file.
   * @param {object} ports - Ports from json file.
   * @param {ComponentDefinition} componentDefinition - Component definition.
   * @returns {ComponentAttribute[]} Restored ports.
   */
  restorePorts(ports, componentDefinition) {
    const portList = [];

    // TODO: is "Array" the right type? Should it be "Link" ?
    // Currently, copied from the jobs of githubator

    Object.values(ports).forEach((portType) => {
      portType.forEach((port) => {
        // Is it useful to skip ports if they are empty
        if (port.linkedTo === null) {
          return;
        }

        portList.push(new ComponentAttribute({
          name: port.name,
          value: [port.linkedTo],
          type: 'Array',
          definition: componentDefinition.definedAttributes.find(
            (attribute) => attribute.name === port.name,
          ),
        }));
      });
    });

    return portList;
  }

  /**
   * Restore the 'parentContainer' attribute from a component.
   * @param {ComponentDefinition} definition The component definition.
   * @param {string} parentId The id of the parent container.
   * @returns {ComponentAttribute} The 'parentContainer' attribute.
   */
  restoreParentContainer(definition, parentId) {
    // TODO: Is it useful to check if the parent container exists?
    // Check if there is a parent container in the stack.
    // const parent = this.containerStack.find((container) => container.id === parentId);
    // if (parent) {
    return new ComponentAttribute({
      name: 'parentContainer',
      value: parentId,
      type: 'string',
      definition: definition.definedAttributes.find((attribute) => attribute.name === 'parentContainer'),
    });
    // }
    //
  }

  /**
   * Generic function to parse an interface (electrical or control).
   * The interface must have a role attribute that indicates if it is an input or an output.
   * It also has to have its ports named "inputName" and "inputSource" for an input interface
   * and "outputName" and "outputSource" for an output interface.
   * @param {object} ctx The parsing context.
   * @param {string} inputInterfaceType The type of the input interface.
   * @param {string} outputInterfaceType The type of the output interface.
   */
  restore_genericInterface(ctx, inputInterfaceType, outputInterfaceType) {
    let interfaceType = '';
    let nameAttributeName = '';
    let sourceAttributeName = '';
    let nameAttributeValue = '';
    let sourceAttributeValue = '';
    // This is a workaround to indicate to search in another file for a specific interface.
    // TODO: Find a way to directly reference the other interface.
    if (ctx.current.attributes.role === 'input') {
      interfaceType = inputInterfaceType;
      nameAttributeName = 'inputName';
      sourceAttributeName = 'inputSource';
      ctx.current.ports.in.forEach((port) => {
        if (port.linkedTo !== null) {
          nameAttributeValue = port.linkedTo;
          sourceAttributeValue = port.source;
        }
      });
      // Remove the port from the list of ports to avoid showing it
      ctx.current.ports.in = [];
    } else if (ctx.current.attributes.role === 'output') {
      interfaceType = outputInterfaceType;
      nameAttributeName = 'outputName';
      sourceAttributeName = 'outputSource';
      ctx.current.ports.out.forEach((port) => {
        if (port.linkedTo !== null) {
          nameAttributeValue = port.linkedTo;
          sourceAttributeValue = port.source;
        }
      });
      // Remove the port from the list of ports to avoid showing it
      ctx.current.ports.out = [];
    } else {
      ctx.progress.warnings.push({
        code: 'invalid_interface_role',
        message: `Invalid interface role: ${ctx.current.attributes.role} for component ${ctx.current.name}`,
      });
      return;
    }

    const definition = this.definitions.find((def) => def.type === interfaceType);
    // Remove the role attribute to avoid showing an attribute that is not defined
    // in the component definition
    delete ctx.current.attributes.role;

    let attributes = this.restoreAttributes(ctx.current.attributes, definition);
    attributes = attributes.concat(this.restorePorts(ctx.current.ports, definition));
    attributes.push(this.restoreParentContainer(definition, ctx.current.parentId));

    // Restore the attributes that are specific to the electrical interface
    // and are dependent on the role
    attributes.push(new ComponentAttribute({
      name: nameAttributeName,
      value: nameAttributeValue,
      type: 'string',
      definition: definition.definedAttributes.find(
        (attribute) => attribute.name === nameAttributeName,
      ),
    }));
    attributes.push(new ComponentAttribute({
      name: sourceAttributeName,
      value: sourceAttributeValue,
      type: 'string',
      definition: definition.definedAttributes.find(
        (attribute) => attribute.name === sourceAttributeName,
      ),
    }));

    const component = this.createComponent(
      ctx.current.name,
      definition,
      attributes,
    );
    this.components.push(component);
  }

  /**
   * Restore a generic line.
   * @param {object} ctx The parsing context.
   */
  restore_genericLine(ctx) {
    const definition = this.definitions.find((def) => def.type === ctx.current.type);
    const attributes = this.restoreAttributes(ctx.current.attributes, definition);
    attributes.push(this.restoreParentContainer(definition, ctx.current.parentId));

    const component = this.createComponent(
      ctx.current.name,
      definition,
      attributes,
    );
    this.components.push(component);
  }

  enter_Container(ctx) {
    const definition = this.definitions.find((def) => def.type === ctx.current.type);
    const attributes = this.restoreAttributes(ctx.current.attributes, definition);
    attributes.push(this.restoreParentContainer(definition, ctx.current.parentId));

    this.containerStack.push(this.createComponent(
      ctx.current.name,
      definition,
      attributes,
    ));
  }

  exit_Container() {
    this.components.push(this.containerStack.pop());
  }

  /**
   * Create a generic dipole.
   * Can be used for other components that have the same interface as a generic dipole.
   * The component must have a name, a type and a parent id.
   * @param {object} ctx The parsing context.
   */
  enter_genericDipole(ctx) {
    const definition = this.definitions.find((def) => def.type === ctx.current.type);
    let attributes = this.restoreAttributes(ctx.current.attributes, definition);
    attributes = attributes.concat(this.restorePorts(ctx.current.ports, definition));
    attributes.push(this.restoreParentContainer(definition, ctx.current.parentId));

    const component = this.createComponent(
      ctx.current.name,
      definition,
      attributes,
    );
    this.components.push(component);
  }

  exit_genericDipole() {}

  enter_electricalInterface(ctx) {
    this.restore_genericInterface(ctx, 'electricalInputInterface', 'electricalOutputInterface');
  }

  exit_electricalInterface() {

  }

  enter_electricalLine(ctx) {
    this.restore_genericLine(ctx);
  }

  exit_electricalLine() {}

  enter_controlInterface(ctx) {
    this.restore_genericInterface(ctx, 'controlInputInterface', 'controlOutputInterface');
  }

  exit_controlInterface() {}

  enter_controlLine(ctx) {
    this.restore_genericLine(ctx);
  }

  exit_controlLine() {}

  enter_circuitBreaker(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_circuitBreaker() {}

  enter_externalDevice(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_externalDevice() {}

  enter_contactor(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_contactor() {}

  enter_switch(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_switch() {}

  enter_energyMeter(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_energyMeter() {}

  enter_mxCoil(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_mxCoil() {}

  enter_securityKey(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_securityKey() {}

  enter_transformer(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_transformer() {}

  enter_ground(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_ground() {}

  enter_fuse(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_fuse() {}

  enter_switchDisconnector(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_switchDisconnector() {}

  enter_disconnector(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_disconnector() {}

  enter_electricalSupply(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_electricalSupply() {}

  enter_manualActuator(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_manualActuator() {}

  enter_kmCoil(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_kmCoil() {}

  enter_generalActuator(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_generalActuator() {}

  enter_sts(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_sts() {}

  enter_junctionBox(ctx) {
    this.enter_genericDipole(ctx);
  }

  exit_junctionBox() {}
}

export { ElectrificatorListener };
