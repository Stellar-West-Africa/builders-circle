# Contributing to Stellar WA Builders Circle

## How to Earn Points

Points are tracked on our [leaderboard](./LEADERBOARD.md) and contribute to monthly prizes and quarterly raffles.

### Finding Issues

1. **Browse the [Stellar OSS Issues platform](https://stellar-oss-issues.vercel.app)**
   - Filter by tech stack and difficulty
   - Find issues that match your skills

2. **Check tracked repositories**
   - See [LEADERBOARD.md](./LEADERBOARD.md) for list of tracked repos
   - Look for issues labeled with your areas of interest

3. **Comment to get assigned**
   - Avoid working on unassigned issues
   - Wait for maintainer confirmation

### Making Contributions

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/repository-name.git
   cd repository-name
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Follow the project's code style
   - Write clear commit messages
   - Add tests if applicable

4. **Push and create PR**
   ```bash
   git push origin your-branch-name
   ```
   - Create Pull Request on GitHub
   - Reference the issue you're fixing
   - Describe your changes

5. **Get merged**
   - Address review feedback
   - Once merged, points are automatically calculated

## Point System

Points are calculated based on:

### Labels (Base Points)
- `security`, `critical`, `breaking-change`: **8 points**
- `high-priority`, `feature`, `performance`: **5 points**
- `bug`, `enhancement`, `refactor`: **3 points**
- `ui`, `testing`, `help-wanted`: **2 points**
- `documentation`, `good-first-issue`: **1 point**

### Size Multipliers
- **Files changed**: 4-10 files (1.2×), 11-20 files (1.5×), 21+ files (2.0×)
- **Lines changed**: 51-200 lines (1.2×), 201-500 lines (1.5×), 501+ lines (2.0×)

### Calculation
```
Final Points = max(label points) × size multiplier
```

See [`config/points.json`](./config/points.json) for complete details.

## Best Practices

### Code Quality
- Follow existing code style
- Write self-documenting code
- Add comments for complex logic
- Keep functions small and focused

### Testing
- Write tests for new features
- Ensure existing tests pass
- Test edge cases

### Documentation
- Update README if needed
- Add docstrings for new functions
- Include usage examples

### Communication
- Be respectful in all interactions
- Ask questions if requirements are unclear
- Respond to reviewer feedback promptly

## Submitting Your Project

To add your project to the showcase:

1. Create a new file: `projects/your-project-name.md`
2. Follow the [project template](./projects/README.md)
3. Submit a PR to this repository

## Getting Help

- **Community Channel**: 24/7 builder support (invite only)
- **Weekly Syncs**: Every Wednesday 18:00 WAT
- **Questions**: Open an issue in this repository

## Code of Conduct

- Be respectful and inclusive
- Give constructive feedback
- Accept criticism gracefully
- Focus on what's best for the community

---

Happy building!
