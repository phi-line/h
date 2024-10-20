interface IVRNode {
  question: string;
  options: string[];
  callId: string;
  children: Map<string, IVRNode>;
}

export class IVRTree {
  private root: IVRNode;

  constructor() {
    this.root = {
      question: 'root',
      options: [],
      callId: '',
      children: new Map(),
    };
  }

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
  }

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

  getNextUnexploredPath(): string[] | null {
    const queue: [IVRNode, string[]][] = [[this.root, []]];

    while (queue.length > 0) {
      const [node, path] = queue.shift()!;

      for (const option of node.options) {
        if (!node.children.has(option)) {
          return [...path, option];
        }
        queue.push([node.children.get(option)!, [...path, option]]);
      }
    }

    return null; // All paths explored
  }

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

  exportToJson(phoneNumber: string): void {
    const jsonData = JSON.stringify(
      this.root,
      (key, value) => {
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
