const path = require("path");
const ExtractComponentTypesPlugin = require("../index.js");

describe("ExtractComponentTypesPlugin", () => {
  const webpack = require("webpack");

  test("extracts prop types from Button component", (done) => {
    const compiler = webpack({
      mode: "development",
      entry: "./test/components/Button.tsx",
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js",
      },
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: {
              loader: "ts-loader",
              options: {
                transpileOnly: true,
              },
            },
            exclude: /node_modules/,
          },
        ],
      },
      resolve: {
        extensions: [".tsx", ".ts", ".js"],
      },
      plugins: [
        new ExtractComponentTypesPlugin({
          sourceDir: path.resolve(__dirname, "components"),
          debug: true,
        }),
      ],
    });

    compiler.run((err, stats) => {
      try {
        expect(err).toBeNull();

        const info = stats.toJson();
        expect(info.errors).toHaveLength(0);

        // Get extracted types from plugin
        const extractedTypes = compiler.options.plugins[0].typeCache;
        const buttonTypes = extractedTypes["Button"];

        expect(buttonTypes).toBeDefined();
        expect(extractedTypes).toEqual({
          Button: {
            path: "Button",
            props: [
              {
                name: "variant",
                options: ["primary", "secondary"],
                required: true,
                type: "enum-literal",
              },
              {
                name: "size",
                options: ["large", "medium", "small"],
                required: false,
                type: "enum-literal",
              },
              { name: "disabled", required: false, type: "boolean" },
              { name: "onClick", required: true, type: "() => void" },
              { name: "children", required: true, type: "ReactNode" },
            ],
          },
        });
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});
