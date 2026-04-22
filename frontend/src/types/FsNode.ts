export type FsNode = {
    id: string;                 // stable unique id (full path is fine)
    name: string;               // display name
    kind: "dir" | "file";
    children?: FsNode[];        // only for dirs (when loaded/expanded)
    last_modified: number;
};
