module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testMatch: ["**/test/**/*.test.(ts|tsx|js|jsx)"],
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
};
