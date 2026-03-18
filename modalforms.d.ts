
  /**
   * FormBuilder API for programmatically building forms
   * @see https://github.com/danielo515/obsidian-modal-form/blob/master/src/core/FormBuilder.ts
   */
  class FormBuilder {
    constructor(
      definition: FormDefinition,
      reporter: (title: string, message: string) => void
    );
    definition: FormDefinition;
    // Field builder methods
    addTextField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addNumberField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addDateField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addTimeField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addDateTimeField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addTextareaField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addToggleField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addEmailField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addTelField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addNoteField(args: { name: string; label?: string; description?: string; folder: string }): FormBuilder;
    addFolderField(args: { name: string; label?: string; description?: string; parentFolder?: string }): FormBuilder;
    addSliderField(args: { name: string; label?: string; description?: string; min?: number; max: number }): FormBuilder;
    addTagField(args: { name: string; label?: string; description?: string; hidden?: boolean }): FormBuilder;
    addSelectField(args: { name: string; label?: string; description?: string; hidden?: boolean; options: (string | { value: string; label: string })[] }): FormBuilder;
    addDataviewField(args: { name: string; label?: string; description?: string; query: string }): FormBuilder;
    addMultiselectField(args: { name: string; label?: string; description?: string; allowUnknownValues?: boolean; options: string[] }): FormBuilder;
    addDocumentBlockField(args: { name: string; label?: string; description?: string; body: string }): FormBuilder;
    addMarkdownBlockField(args: { name: string; label?: string; description?: string; body: string }): FormBuilder;
    addImageField(args: { name: string; label?: string; description?: string; filenameTemplate: string; saveLocation: string }): FormBuilder;
    addFileField(args: { name: string; label?: string; description?: string; folder: string; allowedExtensions: string[] }): FormBuilder;
    // Aliases for field methods
    text: typeof FormBuilder.prototype.addTextField;
    number: typeof FormBuilder.prototype.addNumberField;
    date: typeof FormBuilder.prototype.addDateField;
    time: typeof FormBuilder.prototype.addTimeField;
    datetime: typeof FormBuilder.prototype.addDateTimeField;
    textarea: typeof FormBuilder.prototype.addTextareaField;
    toggle: typeof FormBuilder.prototype.addToggleField;
    email: typeof FormBuilder.prototype.addEmailField;
    tel: typeof FormBuilder.prototype.addTelField;
    note: typeof FormBuilder.prototype.addNoteField;
    folder: typeof FormBuilder.prototype.addFolderField;
    slider: typeof FormBuilder.prototype.addSliderField;
    tag: typeof FormBuilder.prototype.addTagField;
    select: typeof FormBuilder.prototype.addSelectField;
    dataview: typeof FormBuilder.prototype.addDataviewField;
    multiselect: typeof FormBuilder.prototype.addMultiselectField;
    document_block: typeof FormBuilder.prototype.addDocumentBlockField;
    markdown_block: typeof FormBuilder.prototype.addMarkdownBlockField;
    image: typeof FormBuilder.prototype.addImageField;
    file: typeof FormBuilder.prototype.addFileField;
    // Build method
    build(): FormDefinition;
  }
// modalforms.d.ts
// Minimal type definitions for the Obsidian Modal Forms plugin API
// Expand as needed for your usage

declare namespace ModalForms {
  interface Api {
    /**
     * Opens a form by name or inline definition and returns a FormResult.
     */
    openForm(formReference: string | FormDefinition, options?: FormOptions): Promise<FormResult>;
    /**
     * Opens a named form by name.
     */
    namedForm(name: string, options?: FormOptions): Promise<FormResult>;
    /**
     * Opens a named form, limiting or filtering the fields included.
     */
    limitedForm(name: string, limitOpts: { pick?: string[]; omit?: string[] }, formOpts?: FormOptions): Promise<FormResult>;
    /**
     * Opens a modal form with the provided form definition.
     */
    openModalForm(formDefinition: FormDefinition, options?: FormOptions): Promise<FormResult>;
    /**
     * Opens the example form.
     */
    exampleForm(options?: FormOptions): Promise<FormResult>;
    /**
     * Opens the template builder for a form by name.
     */
    openInTemplateBuilder(name: string): void;
  }

  /**
   * Options for opening a form
   */
  interface FormOptions {
    values?: Record<string, any>; // Default values for fields
    // Future options can be added here
  }

  /**
   * A valid form definition for Modal Forms
   * @see https://github.com/danielo515/obsidian-modal-form/blob/master/src/core/formDefinition.ts
   */
  interface FormDefinition {
    title: string;
    fields: FieldDefinition[];
    name?: string; // Optional, but present in most saved forms
    customClassname?: string;
    version?: string; // e.g., "1"
    template?: {
      createInsertCommand?: boolean;
      createNoteCommand?: boolean;
      parsedTemplate?: any;
    };
    // ...other optional properties
  }

  /**
   * A field in a Modal Form
   * @see https://github.com/danielo515/obsidian-modal-form/blob/master/src/core/formDefinitionSchema.ts
   */
  /**
   * A field in a Modal Form. Use the appropriate interface for each type for best IntelliSense.
   */
  type FieldDefinition =
    | TextFieldDefinition
    | NumberFieldDefinition
    | EmailFieldDefinition
    | TelFieldDefinition
    | DateFieldDefinition
    | TimeFieldDefinition
    | DateTimeFieldDefinition
    | TextareaFieldDefinition
    | ToggleFieldDefinition
    | NoteFieldDefinition
    | FolderFieldDefinition
    | SliderFieldDefinition
    | TagFieldDefinition
    | SelectFieldDefinition
    | DataviewFieldDefinition
    | MultiselectFieldDefinition
    | DocumentBlockFieldDefinition
    | MarkdownBlockFieldDefinition
    | ImageFieldDefinition
    | FileFieldDefinition;

  interface BaseFieldDefinition {
    name: string;
    label?: string;
    description?: string;
    required?: boolean;
    input?: { type: FieldType };
  }

  interface TextFieldDefinition extends BaseFieldDefinition {
    type: "text";
    hidden?: boolean;
  }
  interface NumberFieldDefinition extends BaseFieldDefinition {
    type: "number";
    hidden?: boolean;
  }
  interface EmailFieldDefinition extends BaseFieldDefinition {
    type: "email";
    hidden?: boolean;
  }
  interface TelFieldDefinition extends BaseFieldDefinition {
    type: "tel";
    hidden?: boolean;
  }
  interface DateFieldDefinition extends BaseFieldDefinition {
    type: "date";
    hidden?: boolean;
  }
  interface TimeFieldDefinition extends BaseFieldDefinition {
    type: "time";
    hidden?: boolean;
  }
  interface DateTimeFieldDefinition extends BaseFieldDefinition {
    type: "datetime";
    hidden?: boolean;
  }
  interface TextareaFieldDefinition extends BaseFieldDefinition {
    type: "textarea";
    hidden?: boolean;
  }
  interface ToggleFieldDefinition extends BaseFieldDefinition {
    type: "toggle";
    hidden?: boolean;
  }
  interface NoteFieldDefinition extends BaseFieldDefinition {
    type: "note";
    folder: string;
  }
  interface FolderFieldDefinition extends BaseFieldDefinition {
    type: "folder";
    parentFolder?: string;
  }
  interface SliderFieldDefinition extends BaseFieldDefinition {
    type: "slider";
    min?: number;
    max: number;
  }
  interface TagFieldDefinition extends BaseFieldDefinition {
    type: "tag";
    hidden?: boolean;
  }
  interface SelectFieldDefinition extends BaseFieldDefinition {
    type: "select";
    hidden?: boolean;
    options: (string | { value: string; label: string })[];
    source?: "fixed";
  }
  interface DataviewFieldDefinition extends BaseFieldDefinition {
    type: "dataview";
    query: string;
  }
  interface MultiselectFieldDefinition extends BaseFieldDefinition {
    type: "multiselect";
    allowUnknownValues?: boolean;
    options: string[];
    source?: "fixed";
    multi_select_options?: string[];
  }
  interface DocumentBlockFieldDefinition extends BaseFieldDefinition {
    type: "document_block";
    body: string;
  }
  interface MarkdownBlockFieldDefinition extends BaseFieldDefinition {
    type: "markdown_block";
    body: string;
  }
  interface ImageFieldDefinition extends BaseFieldDefinition {
    type: "image";
    filenameTemplate: string;
    saveLocation: string;
  }
  interface FileFieldDefinition extends BaseFieldDefinition {
    type: "file";
    folder: string;
    allowedExtensions: string[];
  }
  /**
   * Error type for Modal Forms plugin
   */
  class ModalFormError extends Error {
    constructor(message: string, details?: string);
    details?: string;
  }

  /**
   * Factory for creating a FormBuilder
   * @param reporter A function to report errors (title, message)
   * @returns A function that creates a FormBuilder for a given name, title, and fields
   */
  function makeBuilder(
    reporter: (title: string, message: string) => void
  ): (name: string, title?: string, fields?: FieldDefinition[]) => FormBuilder;

  /**
   * All supported field types for Modal Forms
   * @see https://github.com/danielo515/obsidian-modal-form/blob/master/src/core/input/InputDefinitionSchema.ts
   */
  type FieldType =
    | "number"
    | "text"
    | "email"
    | "tel"
    | "date"
    | "time"
    | "datetime"
    | "textarea"
    | "toggle"
    | "note"
    | "folder"
    | "slider"
    | "tag"
    | "select"
    | "dataview"
    | "multiselect"
    | "document_block"
    | "markdown_block"
    | "image"
    | "file";

  /**
   * The result object returned by openForm
   */
  interface FormResult {
    /** Returns the data as a frontmatter YAML string */
    asFrontmatterString(options?: { pick?: string[]; omit?: string[] }): string;
    /** Alias for asFrontmatterString */
    asFrontmatter(options?: { pick?: string[]; omit?: string[] }): string;
    /** Alias for asFrontmatterString */
    asYaml(options?: { pick?: string[]; omit?: string[] }): string;
    /** Returns the data as a dataview properties string */
    asDataviewProperties(options?: { pick?: string[]; omit?: string[] }): string;
    /** Alias for asDataviewProperties */
    asDataview(options?: { pick?: string[]; omit?: string[] }): string;
    /** Alias for asDataviewProperties */
    asDv(options?: { pick?: string[]; omit?: string[] }): string;
    /** Returns a copy of the form data */
    getData(): Record<string, any>;
    /** Returns the data formatted as a string using a template */
    asString(template: string): string;
    /** Returns the value for a key, or empty string if not found */
    get(key: string, mapFn?: (value: any) => any): any;
    /** Returns a ResultValue object for a key */
    getValue(key: string): ResultValue;
    /** Alias for getValue */
    getV(key: string): ResultValue;
    /** Property accessors for each field (dynamic) */
    [key: string]: any;
  }

  /**
   * A wrapper for a single result value, with helpers for rendering
   */
  interface ResultValue {
    value: any;
    bullets?: string;
    // Add more as needed from plugin docs
  }
}
