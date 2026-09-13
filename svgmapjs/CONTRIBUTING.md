# Contributing to SVGMap

Thank you for your interest in contributing to the SVGMap project! We welcome all contributions to improve the framework.

## Getting Started

### Branching Strategy
- Contributions (Pull Requests) are only accepted for `dev*` branches (e.g., `dev2`).
- Pull requests directly to the `main` branch will generally not be accepted.

### Local Development Setup
To set up the project locally:

```bash
# Install dependencies
npm install

# Install Playwright (for E2E tests)
npx playwright install
sudo npx playwright install-deps
```

## Coding Standards

### Formatter
The project uses `prettier`. Please ensure your code is formatted before committing.
Indentation must be set to **Tabs** as per the `.prettierrc` configuration.

```bash
# Example to format files
npx prettier --write .
```

## Running Tests

Before submitting a pull request, ensure all tests pass.

### Unit Tests
Logic-based tests using Jest.

```bash
npm test
```

### E2E Tests
Browser-based interaction tests using Playwright.

```bash
npm run e2e
```

## Reporting Issues

If you encounter any bugs, have questions, or want to suggest improvements, please [open an issue](https://github.com/svgmap/svgmapjs/issues). Providing as much detail as possible (e.g., steps to reproduce, environment info) helps us resolve things faster.

## Submitting a Pull Request

For major changes, please open an issue first to discuss what you would like to change. This ensures your contribution aligns with the project's direction and avoids duplicated efforts.

1. Fork the repository.
2. Create a new branch for your feature or fix (e.g., `feature/your-feature-name`).
3. Make your changes and ensure all tests pass.
4. Create a Pull Request against the corresponding `dev*` branch.
5. Provide a clear description of your changes and reference any related Issues.

## License

By contributing to this project, you agree that your contributions will be licensed under the [MPL-2.0 License](LICENSE).
