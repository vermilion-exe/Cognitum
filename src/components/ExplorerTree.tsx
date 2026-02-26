import { FsNode } from "./Explorer";
import directoryIcon from "../assets/directory.svg";
import openDirectoryIcon from "../assets/directory_open.svg";

function ExplorerTree({ nodes, depthPipes = [], isRoot, }: { nodes: FsNode[]; depthPipes?: boolean[]; isRoot: boolean; }) {
    return (
        <div className={`flex flex-col gap-2 ${!isRoot ? "ml-9" : ""}`}>
            {
                nodes.map((node, idx) => {
                    const isLast = idx === nodes.length - 1;
                    const nextPipes = [...depthPipes, !isLast];

                    return (
                        <div key={node.id}>
                            <TreeRow node={node} pipes={depthPipes} isLast={isLast} />

                            {node.kind === "dir" && node.isOpen && node.children?.length ? (
                                <div>
                                    <ExplorerTree nodes={node.children} depthPipes={nextPipes} isRoot={false} />
                                </div>
                            ) : null}
                        </div>
                    );
                })
            }
        </div>
    );
}

function TreeRow({ node, pipes, isLast, }: { node: FsNode; pipes: boolean[]; isLast: boolean; }) {
    return (
        <div className="tree-row">
            <div className='flex items-stretch'>
                {pipes.map((on, i) => (
                    <div key={i} className="relative">
                        {on ? (<div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />) : null}
                    </div>
                ))}
            </div>

            <div className="relative">
                {!isLast ? (
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
                ) : null}
            </div>

            <div className="flex items-center gap-2 min-w-0">
                {node.kind === "dir" ? (node.isOpen ? (<img className="w-7 h-7" src={openDirectoryIcon} />) : (<img className="w-6 h-6" src={directoryIcon} />)) : null}
                <span className="tree-label truncate">{node.name}</span>
            </div>
        </div>
    );
}

export default ExplorerTree
