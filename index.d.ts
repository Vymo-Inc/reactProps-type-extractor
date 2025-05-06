import { Compiler, WebpackPluginInstance } from "webpack";
import * as ts from "typescript";

interface ExtractComponentTypesOptions {
  sourceDir: string;
  tsConfigPath?: string;
  debug?: boolean;
  generateJson?: boolean;
}

interface PropTypeResult {
  path: string;
  props: PropDefinition[];
}

interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  options?: string[];
  children?: PropDefinition[];
}

interface TypeCache {
  [key: string]: PropTypeResult;
}

declare class ExtractComponentTypesPlugin implements WebpackPluginInstance {
  private options: ExtractComponentTypesOptions;
  private typeCache: TypeCache;
  private processedTypes: Set<string>;
  private hasRun: boolean;

  constructor(options?: Partial<ExtractComponentTypesOptions>);

  private log(message: string): void;
  private getAllFiles(dir: string, extension: string): string[];
  private getTSConfig(): ts.CompilerOptions;
  private unwrapComponent(
    node: ts.Node,
    checker: ts.TypeChecker
  ): ts.Type | null;
  private processSourceFile(
    program: ts.Program,
    sourceFile: ts.SourceFile
  ): PropTypeResult | null;
  private processTSFiles(files: string[]): number;
  private injectTypes(compiler: Compiler): void;

  static extractTypeProps(
    checker: ts.TypeChecker,
    type: ts.Type,
    processedTypes?: Set<string>
  ): PropDefinition[];
  static getTypeKind(type: ts.Type, checker: ts.TypeChecker): string;
  static isPrimitiveType(type: ts.Type, checker: ts.TypeChecker): boolean;
  static isBuiltInType(type: ts.Type, checker: ts.TypeChecker): boolean;
  static cleanupTypeString(type: ts.Type, checker: ts.TypeChecker): string;
  static isReactType(type: ts.Type, checker: ts.TypeChecker): boolean;
  static parseUnionType(
    checker: ts.TypeChecker,
    name: string,
    type: ts.Type,
    isOptional: boolean,
    processedTypes: Set<string>
  ): PropDefinition;
  static parseLiteralType(
    type: ts.Type,
    checker: ts.TypeChecker
  ): string | null;
  static parseEnumLiteralType(
    checker: ts.TypeChecker,
    name: string,
    aliasType: ts.Type,
    isOptional: boolean
  ): PropDefinition;
  static parseObjectType(
    checker: ts.TypeChecker,
    name: string,
    type: ts.Type,
    isOptional: boolean,
    processedTypes: Set<string>
  ): PropDefinition;
  static parseProperty(
    checker: ts.TypeChecker,
    name: string,
    type: ts.Type,
    isOptional: boolean,
    processedTypes: Set<string>
  ): PropDefinition;
  static getPropsFromFunction(
    node: ts.SignatureDeclarationBase,
    checker: ts.TypeChecker
  ): ts.Type | null;
  static getPropsFromForwardRef(
    node: ts.CallExpression,
    checker: ts.TypeChecker,
    unwrapFn: (node: ts.Node, checker: ts.TypeChecker) => ts.Type | null
  ): ts.Type | null;
  static getPropsFromCallExpression(
    node: ts.CallExpression,
    checker: ts.TypeChecker,
    unwrapFn: (node: ts.Node, checker: ts.TypeChecker) => ts.Type | null
  ): ts.Type | null;

  apply(compiler: Compiler): void;
}

export = ExtractComponentTypesPlugin;
