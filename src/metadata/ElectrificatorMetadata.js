import { DefaultMetadata, ComponentDefinition, ComponentAttributeDefinition } from 'leto-modelizer-plugin-core';

/*
 * Metadata is used to generate definition of Component and ComponentAttribute.
 *
 * In our plugin managing Terraform, we use [Ajv](https://ajv.js.org/) to validate metadata.
 * And we provide a `metadata.json` to define all metadata.
 *
 * Feel free to manage your metadata as you wish.
 */
class ElectrificatorMetadata extends DefaultMetadata {
  validate() {
    return super.validate();
  }

  parse() {
    /*
     * Implement this to provide all the definitions describing the components.
     *
     * ComponentDefinition is used to generate the instantiable component list.
     *
     * And the componentAttributeDefinition is used to generate the form to update a component.
     *
     * Both of them can be also used to check components in parser and generate errors.
     */

    const objectDefinition = new ComponentDefinition('object');
    objectDefinition.definedAttributes.push(new ComponentAttributeDefinition(
      'name',
      'string',
      [],
      true,
    ));
    objectDefinition.isContainer = true;

    const innerObjectDefinition = new ComponentDefinition('innerObject');
    innerObjectDefinition.definedAttributes.push(new ComponentAttributeDefinition(
      'name',
      'string',
      [],
      true,
    ));

    this.pluginData.definitions = {
      components: [objectDefinition, innerObjectDefinition],
    };
  }
}

export default ElectrificatorMetadata;