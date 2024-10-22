/**
 * @fileoverview This file contains the definition and implementation of the IVRTree class, swhich represents an Interactive Voice Response (IVR) tree structure. It allows for adding, retrieving, and exporting nodes within the tree.
 */

/**
 * Represents a node in the IVR tree.
 * @interface
 */
interface IVRNode {
  /** The question or prompt at this node. */
  question: string;
  /** The available options at this node. */
  options: string[];
  /** The call identifier associated with this node. */
  callId: string;
  /** The children nodes mapped by option strings. */
  children: Map<string, IVRNode>;
}

/**
 * Represents an Interactive Voice Response (IVR) tree.
 * @class
 */
export class IVRTree {
  /** The root node of the IVR tree. */
  private root: IVRNode;
  /** A set of explored paths in the IVR tree. */
  private exploredPaths: Set<string>;

  /**
   * Creates an instance of IVRTree.
   */
  constructor() {
    this.root = {
      question: 'root',
      options: [],
      callId: '',
      children: new Map(),
    };
    this.exploredPaths = new Set();
  }

  /**
   * Adds a node to the IVR tree at the specified path.
   * @param {string[]} path - The path to the node.
   * @param {string} question - The question or prompt for the node.
   * @param {string[]} options - The options available at the node.
   * @param {string} callId - The call identifier associated with the node.
   */
  addNode(
    path: string[],
    question: string,
    options: string[],
    callId: string,
  ): void {
    let currentNode = this.root;

    for (const option of path) {
      if (!currentNode.children.has(option)) {
        currentNode.children.set(option, {
          question: '',
          options: [],
          callId: '',
          children: new Map(),
        });
      }
      currentNode = currentNode.children.get(option)!;
    }

    currentNode.question = question;
    currentNode.options = options;
    currentNode.callId = callId;

    this.exploredPaths.add(this.pathToString(path, question));
  }

  /**
   * Retrieves a node from the IVR tree at the specified path.
   * @param {string[]} path - The path to the node.
   * @returns {IVRNode} The node at the specified path.
   * @throws Will throw an error if the path is invalid.
   */
  getNode(path: string[]): IVRNode {
    let currentNode = this.root;

    for (const option of path) {
      if (!currentNode.children.has(option)) {
        throw new Error(`Invalid path: ${path.join(' -> ')}`);
      }
      currentNode = currentNode.children.get(option)!;
    }

    return currentNode;
  }

  /**
   * Finds the next unexplored path in the IVR tree.
   * @returns {string[] | null} The next unexplored path, or null if all paths are explored.
   */
  getNextUnexploredPath(): string[] | null {
    const queue: [IVRNode, string[]][] = [[this.root, []]];

    while (queue.length > 0) {
      const [node, path] = queue.shift()!;

      for (const option of node.options) {
        const newPath = [...path, option];
        if (!node.children.has(option)) {
          if (!this.isPathExplored(newPath, node.question)) {
            return newPath;
          }
        } else {
          queue.push([node.children.get(option)!, newPath]);
        }
      }
    }

    return null;
  }

  /**
   * Converts a path and question to a string representation.
   * @private
   * @param {string[]} path - The path to convert.
   * @param {string} question - The question to include in the string.
   * @returns {string} The string representation of the path and question.
   */
  private pathToString(path: string[], question: string): string {
    return `${path.join('->')}:${question}`;
  }

  /**
   * Checks if a path has been explored.
   * @private
   * @param {string[]} path - The path to check.
   * @param {string} question - The question associated with the path.
   * @returns {boolean} True if the path has been explored, false otherwise.
   */
  private isPathExplored(path: string[], question: string): boolean {
    return this.exploredPaths.has(this.pathToString(path, question));
  }

  /**
   * Prints the IVR tree to the console.
   */
  print(): void {
    const printNode = (node: IVRNode, indent: string = '') => {
      console.log(`${indent}Question: ${node.question}`);
      console.log(`${indent}Options: ${node.options.join(', ')}`);
      node.children.forEach((child, option) => {
        console.log(`${indent}  ${option}:`);
        printNode(child, indent + '    ');
      });
    };

    printNode(this.root);
  }

  /**
   * Exports the IVR tree to a JSON file.
   * @param {string} phoneNumber - The phone number to use as the file name.
   */
  exportToJson(phoneNumber: string): void {
    const jsonData = JSON.stringify(
      this.root,
      (_, value) => {
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
        return value;
      },
      2,
    );

    const directoryName = 'discovery';
    try {
      Deno.mkdirSync(directoryName, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        console.error(`Failed to create directory ${directoryName}:`, error);
        return;
      }
    }

    const fileName = `${directoryName}/${phoneNumber}.json`;
    try {
      Deno.writeTextFileSync(fileName, jsonData);
      console.log(`IVR tree exported to ${fileName}`);
    } catch (error) {
      console.error(`Failed to write file ${fileName}:`, error);
    }
  }
}
