# ExtractComponentPropTypes Webpack Plugin

A webpack plugin that extracts TypeScript component prop types at build time. This plugin analyzes your React components and generates a structured representation of their prop types, which can be useful for documentation, runtime type checking, or component validation.

## Features

- Extracts prop types from React functional components
- Supports wrapped components (`memo`, `forwardRef`)
- Handles various TypeScript types:
  - Primitive types (string, number, boolean)
  - Union types
  - Enum literals
  - Object types
  - Built-in types
  - React-specific types
- Provides recursive type analysis
- Excludes test and story files automatically

## Installation

```bash
npm install --save-dev extract-component-proptypes-webpack-plugin
```

## Usage

In your webpack configuration:

```javascript
const ExtractComponentTypesPlugin = require("./config/webpack/plugins/extractComponentPropTypes");

module.exports = {
  // ... other webpack config
  plugins: [
    new ExtractComponentTypesPlugin({
      sourceDir: "src",
      tsConfigPath: "tsconfig.json",
      debug: false,
    }),
  ],
};
```

## Configuration Options

| Option         | Type      | Default           | Description                                                                                  |
| -------------- | --------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `sourceDir`    | `string`  | required          | The source directory containing your TypeScript/React components                             |
| `tsConfigPath` | `string`  | `'tsconfig.json'` | Path to your TypeScript configuration file                                                   |
| `debug`        | `boolean` | `false`           | Enable debug logging for the plugin                                                          |
| `generateJson` | `boolean` | `false`           | will generate JSON file `componentProps.json` at root folder containing extracted prop types |

## Output Format

The plugin extracts prop types in the following format:

```typescript
interface PropType {
  name: string; // Name of the prop
  type: string; // Type of the prop
  required: boolean; // Whether the prop is required
  options?: string[]; // Available options for enum-literals
  children?: PropType[]; // Nested prop types for objects
}
```

### Type Categories

- `primitive`: Basic types like string, number, boolean
- `object`: Complex object types with nested properties
- `enum-literal`: String or number literal unions
- `union`: Union types that don't resolve to enum-literals
- `array`: Array types
- `tuple`: Tuple types
- `function`: Function types
- `unknown`: Types that couldn't be resolved

## Example Output

For a component like:

```typescript
interface ButtonProps {
  variant: "primary" | "secondary";
  size?: "small" | "medium" | "large";
  onClick: () => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  onClick,
  disabled,
}) => {
  // ... component implementation
};
```

The plugin will generate:

```javascript
{
  "Button": {
    "variant": {
      "name": "variant",
      "type": "enum-literal",
      "required": true,
      "options": ["primary", "secondary"]
    },
    "size": {
      "name": "size",
      "type": "enum-literal",
      "required": false,
      "options": ["small", "medium", "large"]
    },
    "onClick": {
      "name": "onClick",
      "type": "() => void",
      "required": true
    },
    "disabled": {
      "name": "disabled",
      "type": "boolean",
      "required": false
    }
  }
}
```

## Notes

- The plugin automatically excludes `.stories.tsx`, `.test.tsx`, and `.spec.tsx` files
- Type information is extracted at build time and made available through webpack's DefinePlugin
- Circular type references are handled to prevent infinite recursion
- React-specific types are simplified (e.g., `React.ReactNode` becomes `ReactNode`)

## Contributing

We welcome contributions to improve the ExtractComponentPropTypes plugin! Here's how you can help:

### Development Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

### Making Changes

1. Make sure your code follows our coding standards:

   - Keep the code modular and maintainable
   - Add comments for complex logic

2. Testing:

   - Add test cases for new features or bug fixes
   - Run existing tests to ensure nothing is broken:
     ```bash
     npm test
     ```
   - Test the plugin with different types of React components
   - Verify output matches expected type definitions

3. Documentation:
   - Update README.md for any new features or changes
   - Document any breaking changes

### Bug Reports

When submitting bug reports, please include:

- Plugin version
- Webpack version
- TypeScript version
- Minimal reproduction repository
- Expected vs actual behavior
- Error messages or stack traces
