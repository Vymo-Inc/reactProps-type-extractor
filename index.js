/* eslint-disable no-bitwise */
const ts = require("typescript");
const path = require("path");
const fs = require("fs");
const webpack = require("webpack");

class ExtractComponentTypesPlugin {
  constructor(options = {}) {
    this.options = {
      sourceDir: options.sourceDir,
      tsConfigPath: options.tsConfigPath || "tsconfig.json",
      debug: options.debug || false,
      envStringified: options.envStringified,
    };

    this.typeCache = {};
    this.processedTypes = new Set();
    this.hasRun = false;
  }

  log(message) {
    if (this.options.debug) {
      console.log(`[ExtractComponentTypes] ${message}`);
    }
  }

  getAllFiles(dir, extension) {
    let files = [];
    const entries = fs.readdirSync(dir);

    entries.forEach((entry) => {
      const entryPath = path.join(dir, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isDirectory()) {
        files = files.concat(this.getAllFiles(entryPath, extension));
      } else if (
        entryPath.endsWith(extension) &&
        !entryPath.endsWith(".stories.tsx") &&
        !entryPath.endsWith(".test.tsx") &&
        !entryPath.endsWith(".spec.tsx")
      ) {
        files.push(entryPath);
      }
    });

    return files;
  }

  getTSConfig() {
    const configFile = ts.readConfigFile(
      this.options.tsConfigPath,
      ts.sys.readFile
    );

    const { options } = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(this.options.tsConfigPath)
    );

    return options;
  }

  static extractTypeProps(checker, type, processedTypes = new Set()) {
    const result = [];

    if (!type || typeof type.getProperties !== "function") {
      return [];
    }

    const typeId = checker.typeToString(type);
    if (processedTypes.has(typeId)) {
      return [];
    }

    processedTypes.add(typeId);

    // eslint-disable-next-line no-restricted-syntax
    for (const symbol of type.getProperties()) {
      if (!symbol.valueDeclaration) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const name = symbol.getName();
      // eslint-disable-next-line no-bitwise
      const isOptional = (symbol.flags & ts.SymbolFlags.Optional) !== 0;
      const propType = checker.getTypeOfSymbolAtLocation(
        symbol,
        symbol.valueDeclaration
      );

      const field = this.parseProperty(
        checker,
        name,
        propType,
        isOptional,
        processedTypes
      );
      result.push(field);
    }

    return result;
  }

  // eslint-disable-next-line complexity
  static getTypeKind(type, checker) {
    // Unwrap alias
    if (type.aliasSymbol) {
      type = checker.getDeclaredTypeOfSymbol(type.aliasSymbol);
    }

    // Handle array types
    if (checker.isArrayType(type)) {
      return "array";
    }

    // Handle tuple types
    if (checker.isTupleType(type)) {
      return "tuple";
    }

    // Handle union type
    if (type.isUnion()) {
      return "union";
    }

    // Handle intersection type
    if (type.isIntersection()) {
      return "intersection";
    }

    // Handle function type (has call signatures)
    if (type.getCallSignatures().length > 0) {
      return "function";
    }

    // Handle real enum
    if (type.symbol?.flags & ts.SymbolFlags.Enum) {
      return "enum";
    }

    // Handle literal types (string, number, boolean)
    if (
      type.isStringLiteral() ||
      type.isNumberLiteral() ||
      type.flags & ts.TypeFlags.BooleanLiteral
    ) {
      return "enum-literal";
    }

    // Handle object type using proper type guard
    if (type.getProperties().length > 0) {
      return "object";
    }

    // Default fallback
    return "primitive";
  }

  // eslint-disable-next-line max-lines-per-function, complexity
  static isPrimitiveType(type, checker) {
    const typeString = checker.typeToString(type);
    return [
      "string",
      "number",
      "boolean",
      "void",
      "undefined",
      "null",
    ].includes(typeString);
  }

  static isBuiltInType(type, checker) {
    const typeString = checker.typeToString(type);
    return ["Date", "RegExp", "Promise", "Array", "Map", "Set"].some((t) =>
      typeString.startsWith(t)
    );
  }

  static cleanupTypeString(type, checker) {
    let typeStr = checker.typeToString(type);

    // Simplify React types
    if (typeStr.startsWith("React.")) {
      typeStr = typeStr.replace("React.", "");
    }
    if (typeStr.includes("JSX.")) {
      typeStr = typeStr.replace("JSX.", "");
    }

    return typeStr;
  }

  static isReactType(type, checker) {
    const typeString = this.cleanupTypeString(type, checker);
    return ["ReactNode", "ReactElement", "Element"].some((t) =>
      typeString.includes(t)
    );
  }

  static parseUnionType(checker, name, type, isOptional, processedTypes) {
    // Filter out undefined and null
    const validTypes = type.types.filter(
      (t) => !(t.flags & ts.TypeFlags.Undefined || t.flags & ts.TypeFlags.Null)
    );

    const literals = validTypes.filter(
      (t) =>
        t.isStringLiteral() ||
        t.isNumberLiteral() ||
        t.flags & ts.TypeFlags.BooleanLiteral
    );

    const nonLiterals = validTypes.filter((t) => !literals.includes(t));

    // For other literal types - return as enum-literal
    if (literals.length > 0 && nonLiterals.length === 0) {
      // Check for boolean literals (true | false)
      if (
        literals.length === 2 &&
        literals.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)
      ) {
        const values = literals.map((t) => this.parseLiteralType(t, checker));
        if (values.includes("true") && values.includes("false")) {
          return {
            name,
            type: "boolean",
            required: !isOptional,
          };
        }
      }

      const options = literals
        .map((t) => this.parseLiteralType(t, checker))
        .filter(Boolean)
        .sort();

      return {
        name,
        type: "enum-literal",
        required: !isOptional,
        options,
      };
    }

    // Case 2: Single non-literal type
    if (literals.length === 0 && nonLiterals.length === 1) {
      return this.parseProperty(
        checker,
        name,
        nonLiterals[0],
        isOptional,
        processedTypes
      );
    }

    // Case 3: Mixed types or multiple non-literals
    const children = validTypes
      .map((t) =>
        this.parseProperty(checker, name, t, isOptional, processedTypes)
      )
      .filter(Boolean);

    // If somehow we got no valid children, return as unknown type
    if (children.length === 0) {
      return {
        name,
        type: "unknown",
        required: !isOptional,
      };
    }

    return {
      name,
      type: "union",
      required: !isOptional,
      children,
    };
  }

  static parseLiteralType(type, checker) {
    // Handle string literals
    if (type.isStringLiteral()) {
      return type.value;
    }

    // Handle number literals
    if (type.isNumberLiteral()) {
      return type.value.toString();
    }

    // Handle boolean literals
    if (type.flags & ts.TypeFlags.BooleanLiteral) {
      return type.intrinsicName;
    }

    if (this.isReactType(type, checker)) {
      return this.cleanupTypeString(type, checker);
    }

    // For other types, clean up and remove quotes
    const typeStr = this.cleanupTypeString(type, checker);
    return typeStr.replace(/^["']|["']$/g, "");
  }

  static parseEnumLiteralType(checker, name, aliasType, isOptional) {
    if (aliasType.isUnion()) {
      // Delegate to parseUnionType for union types
      return this.parseUnionType(
        checker,
        name,
        aliasType,
        isOptional,
        new Set()
      );
    }

    // Handle single literal type
    if (
      aliasType.isStringLiteral() ||
      aliasType.isNumberLiteral() ||
      aliasType.flags & ts.TypeFlags.BooleanLiteral
    ) {
      const value = this.parseLiteralType(aliasType, checker);
      return {
        name,
        type: "enum-literal",
        required: !isOptional,
        options: [value],
      };
    }

    // For non-literal types, return as a simple type
    return {
      name,
      type: this.cleanupTypeString(aliasType, checker),
      required: !isOptional,
    };
  }

  static parseObjectType(checker, name, type, isOptional, processedTypes) {
    const objType = type.isUnion()
      ? type.types.find(
          (t) => this.cleanupTypeString(t, checker) !== "undefined"
        )
      : type;

    if (!objType || typeof objType.getProperties !== "function") {
      const typeStr = this.cleanupTypeString(type, checker);
      return {
        name,
        type: typeStr,
        required: !isOptional,
      };
    }

    return {
      name,
      type: "object",
      required: !isOptional,
      children: this.extractTypeProps(checker, objType, processedTypes),
    };
  }

  static parseProperty(checker, name, type, isOptional, processedTypes) {
    const aliasType = type.aliasSymbol
      ? checker.getDeclaredTypeOfSymbol(type.aliasSymbol)
      : type;

    // Handle primitive types directly
    if (this.isPrimitiveType(aliasType, checker)) {
      return {
        name,
        type: this.cleanupTypeString(aliasType, checker),
        required: !isOptional,
      };
    }

    // Skip traversing into built-in types and React types
    if (
      this.isBuiltInType(aliasType, checker) ||
      this.isReactType(aliasType, checker)
    ) {
      return {
        name,
        type: this.cleanupTypeString(aliasType, checker),
        required: !isOptional,
      };
    }

    const kind = this.getTypeKind(aliasType, checker);

    if (kind === "union") {
      return this.parseUnionType(
        checker,
        name,
        type,
        isOptional,
        processedTypes
      );
    }

    switch (kind) {
      case "enum-literal":
        return this.parseEnumLiteralType(checker, name, aliasType, isOptional);
      case "object":
        return this.parseObjectType(
          checker,
          name,
          type,
          isOptional,
          processedTypes
        );
      default:
        return {
          name,
          type: this.cleanupTypeString(aliasType, checker),
          required: !isOptional,
        };
    }
  }

  static getPropsFromFunction(node, checker) {
    if (!node.parameters || node.parameters.length === 0) {
      return null;
    }

    const propsParam = node.parameters[0];
    if (propsParam.type) {
      return checker.getTypeAtLocation(propsParam.type);
    }

    return null;
  }

  static getPropsFromForwardRef(node, checker, unwrapFn) {
    // Check type arguments first
    if (node.typeArguments && node.typeArguments.length >= 2) {
      return checker.getTypeAtLocation(node.typeArguments[1]);
    }

    // Fall back to function props
    return unwrapFn(node.arguments[0], checker);
  }

  static getPropsFromCallExpression(node, checker, unwrapFn) {
    const { expression } = node;

    // Get the relevant name - either from Identifier or PropertyAccessExpression
    // eslint-disable-next-line no-nested-ternary
    const name = ts.isIdentifier(expression)
      ? expression.text
      : ts.isPropertyAccessExpression(expression)
      ? expression.name.text
      : null;

    if (!name) {
      return null;
    }

    switch (name) {
      case "memo":
        return unwrapFn(node.arguments[0], checker);
      case "forwardRef":
        return ExtractComponentTypesPlugin.getPropsFromForwardRef(
          node,
          checker,
          unwrapFn
        );
      default:
        return null;
    }
  }

  // eslint-disable-next-line complexity
  unwrapComponent(node, checker) {
    // Handle function declarations and expressions
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      return ExtractComponentTypesPlugin.getPropsFromFunction(node, checker);
    }

    // Handle variable declarations (const Component = ...)
    if (ts.isVariableDeclaration(node) && node.initializer) {
      return this.unwrapComponent(node.initializer, checker);
    }

    // Handle wrapped components (memo, forwardRef)
    if (ts.isCallExpression(node)) {
      return ExtractComponentTypesPlugin.getPropsFromCallExpression(
        node,
        checker,
        this.unwrapComponent.bind(this)
      );
    }

    // Handle identifiers like Avatar , BreadCrumb coming form export expression
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol && symbol.valueDeclaration) {
        return this.unwrapComponent(symbol.valueDeclaration, checker);
      }
    }

    return null;
  }

  processSourceFile(program, sourceFile) {
    const checker = program.getTypeChecker();
    this.log(`Processing file: ${sourceFile.fileName}`);

    // Find export default statement or function
    const defaultExport = sourceFile.statements.find((node) => {
      // Check for export default statement
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        return true;
      }

      // Check for export { x as default }
      if (ts.isExportDeclaration(node) && node.exportClause?.elements) {
        return node.exportClause.elements.some(
          (e) => e.name.text === "default"
        );
      }
      this.log("Found no default export or function", sourceFile.fileName);
      return false;
    });

    if (defaultExport) {
      const componentPropType = this.unwrapComponent(
        ts.isExportAssignment(defaultExport)
          ? defaultExport.expression
          : defaultExport,
        checker
      );

      if (componentPropType) {
        const props = ExtractComponentTypesPlugin.extractTypeProps(
          checker,
          componentPropType
        );
        if (props.length) {
          const relativePath = path
            .relative(this.options.sourceDir, sourceFile.fileName)
            .replace(/\.tsx?$/, "")
            .replace(/\/index$/, "");

          return { path: relativePath, props };
        }
      }
    }

    return null;
  }

  processTSFiles(files) {
    const program = ts.createProgram(files, this.getTSConfig());
    let processed = 0;

    files.forEach((filePath) => {
      const sourceFile = program.getSourceFile(filePath);
      if (sourceFile) {
        const result = this.processSourceFile(program, sourceFile);
        if (result) {
          this.typeCache[result.path] = result;
          this.log(`Processed ${result.path} (${result.props.length} props)`);
          processed++;
        }
      }
    });

    return processed;
  }

  injectTypes(compiler) {
    const definePlugin = new webpack.DefinePlugin({
      COMPONENT_PROPS: JSON.stringify(this.typeCache || {}),
    });

    definePlugin.apply(compiler);
  }

  apply(compiler) {
    // For build mode - process all files once
    compiler.hooks.beforeCompile.tapAsync(
      "ExtractComponentTypes",
      (_params, callback) => {
        if (this.hasRun) {
          callback();
        } else {
          try {
            const uiFiles = this.getAllFiles(this.options.sourceDir, ".tsx");
            this.log(`Found ${uiFiles.length} UI components to process`);

            if (uiFiles.length > 0) {
              const processed = this.processTSFiles(uiFiles);
              this.log(`Processed ${processed} components in build mode`);
              this.injectTypes(compiler);
            }
            this.hasRun = true;
            callback();
          } catch (error) {
            console.error("Error processing components:", error);
            callback(error);
          }
        }
      }
    );

    // For watch mode - handle incremental updates

    compiler.hooks.watchRun.tapAsync(
      "ExtractComponentTypes",
      (watching, callback) => {
        try {
          const changedFiles = Array.from(watching.modifiedFiles || []).filter(
            (file) =>
              file.includes(this.options.sourceDir) &&
              file.endsWith(".tsx") &&
              !file.endsWith(".stories.tsx") &&
              !file.endsWith(".test.tsx") &&
              !file.endsWith(".spec.tsx") &&
              !file.includes("node_modules")
          );

          if (changedFiles.length > 0) {
            this.log(`Processing changed files:\n${changedFiles.join("\n")}`);
            const processed = this.processTSFiles(changedFiles);
            this.log(`Updated ${processed} components in watch mode`);
            this.injectTypes(compiler);
          }

          callback();
        } catch (error) {
          console.error("Error processing changed files:", error);
          callback(error);
        }
      }
    );
  }
}

module.exports = ExtractComponentTypesPlugin;
