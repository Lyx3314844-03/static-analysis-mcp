name: 📝 Pull Request
description: Create a pull request
title: "[PR]: "
labels: []
assignees: []
body:
  - type: markdown
    attributes:
      value: |
        Thanks for taking the time to create a pull request!

  - type: input
    id: issue
    attributes:
      label: Related Issue
      description: Link to the related issue (if any)
      placeholder: "#123"
    validations:
      required: false

  - type: dropdown
    id: type
    attributes:
      label: Type of Change
      description: What type of change does this PR introduce?
      options:
        - Bug fix (non-breaking change which fixes an issue)
        - New feature (non-breaking change which adds functionality)
        - Breaking change (fix or feature that would cause existing functionality to not work as expected)
        - Documentation update
        - Code refactoring
        - Performance improvement
        - Test improvement
        - Build/CI configuration change
        - Other (please describe)
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: A clear and concise description of what this PR does.
    validations:
      required: true

  - type: textarea
    id: testing
    attributes:
      label: How Has This Been Tested?
      description: Describe the tests you ran to verify your changes.
      placeholder: |
        - Test A
        - Test B
    validations:
      required: true

  - type: textarea
    id: checklist
    attributes:
      label: Checklist
      description: Please ensure your PR meets the following requirements
      value: |
        - [ ] My code follows the project's style guidelines
        - [ ] I have performed a self-review of my code
        - [ ] I have commented my code, particularly in hard-to-understand areas
        - [ ] I have made corresponding changes to the documentation
        - [ ] My changes generate no new warnings
        - [ ] I have added tests that prove my fix is effective or that my feature works
        - [ ] New and existing unit tests pass locally with my changes
    validations:
      required: true

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots (if applicable)
      description: Add screenshots to help explain your changes
    validations:
      required: false

  - type: textarea
    id: additional
    attributes:
      label: Additional Notes
      description: Add any other context about the pull request here
    validations:
      required: false
