# mxp - Method: Expedition - Knowledge Engine for Visionary Projects

**mxp** implements the [Expedition Method](EXPEDITION_METHOD.md), a superior form of project management. So superior, it isn't really about "managing" at all. It is about knowledge generation.

MXP has a few key design considerations to make the Expedition Method accessible to all:

- Data is stored in a local Git repository
- Data is stored in markdown files with YAML metadata
- Team support is achieved through the the normal git workflow

## The Expedition Methodology

**mxp** facilitates the [Expedition Method](EXPEDITION_METHOD.md)

## Goals for MXP

- A tool to facilitate the [Expedition Method](EXPEDITION_METHOD.md)
- No hosting required - all you need is a Git repository
- No login required - just use the GitHub OAuth flow
- Leverage git history for project history and branching
- Can co-exist within an existing Git repository
- Multi-user support - achieved in the same way multi-user git works - each user works against their local copy and then pushes/pulls to the remote repository
- Human-editable data structure
  - markdown files are human-editable
  - YAML metadata is human-editable
  - designed to be self-healing (with the help of our tools - e.g. a user can create a new itme and forget to add an ID, the tool will add an ID)
- layered implementation/release approach - we'll build this tool up in layers
- eventually - beautiful UI + AI interface

## Layered Implementation Approach

Build these "modules" in order (they will each be in their own folder):

1. models - internal API for interacting with the data models - see [models/README.md](source/models/README.md)
2. cli - facilitates the expedition method - see [cli/README.md](source/cli/README.md)
3. local web-server - serves the UI - see [web-server/README.md](source/local-server/README.md) - significantly, this server has not AUTH. It is only intended for the local user to interact with the expededition method _as themselves_.

## Features

- **Markdown-based**: Uses markdown files for both project status and deliverables.
- **Metadata-driven**: Extracts YAML metadata from markdown files to structure the project.
- **Web Interface**: Automatically spins up a web server for visualizing and managing the project's status hierarchy and deliverables.
- **Git Integration**: Designed to work within Git-managed repositories, making it easy to track changes over time.

## Installation

You can run the tool directly in any Git folder using `npx`:

```bash
npx mxp
```

## Folder Structure

mxp expects the following folder structure at the root of your Git repository:

```
/expedition/project
  ├── index.md  # Contains metadata and description for the root status node
  └── <subfolders>/  # Arbitrary subfolders for organizing project status
       ├── index.md  # Metadata and description for each subfolder
       └── *.md      # Individual items with no sub-items
/expedition/deliverables
  └── TBD  # Deliverables data structure will be determined in future iterations
```

### Folder Details

- **`/project` (Status Tree)**: This folder represents the status of your project, broken down into a hierarchical structure.

  - `index.md`: Each folder's `index.md` acts as a description and metadata container for that folder.
  - `*.md`: Any markdown file not named `index.md` is considered an individual item. These files can represent individual tasks or items within the folder.

- **`/deliverables`**: This folder will contain deliverable data, which is yet to be fully defined.

## Running the Tool

Once you have the folder structure in place, simply run:

```bash
npx mxp
```

This will launch a local web server that reads the `project` and `deliverables` folders, presenting them as an interactive UI.

- Navigate to the root node (e.g., `/project`) to see the project’s status.
- Click into subfolders to view progress on specific areas.
- Review individual items, which are represented by their `.md` files.

## How mxp Works

- **Markdown Parsing**: The tool will read `index.md` files in each folder, extracting both the markdown content and the YAML metadata (using `gray-matter`). The metadata helps define the structure and properties of each node in the status tree.
- **Web UI**: A simple web interface allows users to navigate through the project's status hierarchy. Future versions will include editors and more interactive features.

## Future Features

- **Deliverables Tracking**: Detailed deliverable structures and their connections to the status tree.
- **Task Assignment**: Associate team members with specific tasks and deliverables.
- **Prioritization Tools**: Help teams set weekly priorities.
- **Time Tracking**: Log developer hours against specific tasks.
- **Advanced Planning**: Support for timelines and dependencies.

## Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests.

## License

This project is licensed under the MIT License.

---

Let me know if you need any more changes or additions!
