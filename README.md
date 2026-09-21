# Szop

Szop is a web application for tracking shopping lists. It is intended not only for groceries but general shopping as well.

## Functionality

Application's functionality (detailed in [docs/requirements/functional-requirements.md](docs/requirements/functional-requirements.md)):

- creation, modification, deletion of shopping lists
- users can create accounts that will hold all their lists and customizations to system functionality
- application functionality will be to some extent available without account creation
- predefined products catalog that can be extended and modified by user
- predefined products categories that can be extended and modified by user
- shopping list functionality:
  - adding products from catalog
  - adding products ad-hoc
  - assigning categories to products
  - checking-off products on the list (and back to non-check state)
- categories functionality:
  - ordering categories so that they will sort products on the list in defined order
  - categories can be hierarchical and products can be assigned to category on any level
- shopping lists can be shared with other users and edited together

## Future possible extensions

- Themes
- Android application
- Advanced functionality only for subscribers
- AI-driven shopping list creation for recipes, events, projects, and other things requiring shopping for multiple products

**Disclaimer:**
The _shop_ application's purpose is for me to learn superpowers workflow but also to learn popular web applications technologies. The implementation process should be a step-by-step one, so I'll keep up with particular elements like project setup and layout, architecture, project layout, technologies choices, CI/CD, building, testing, deployment and other. I intend to use superpowers workflow not only for particular feature implementation but also all other elements of application building.
I also would like to capture all decisions about architecture, solution, approaches and other crucial aspects of implementation within project's documentation.
