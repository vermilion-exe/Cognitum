export type FsNode = {
    id: string;                 // stable unique id (full path is fine)
    name: string;               // display name
    extension?: string;
    kind: "dir" | "file";
    children?: FsNode[];        // only for dirs (when loaded/expanded)
    lastModified?: number;
};
