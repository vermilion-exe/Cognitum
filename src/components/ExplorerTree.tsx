import { FsNode } from "../AppLayout";
import directoryIcon from "../assets/directory.svg";
import openDirectoryIcon from "../assets/directory_open.svg";
import React from "react";

function ExplorerTree({ nodes, depthPipes = [], isRoot, openIds, toggleOpen }: { nodes: FsNode[]; depthPipes?: boolean[]; isRoot: boolean; openIds: Set<String>; toggleOpen: (e: React.MouseEvent, node: FsNode) => void; }) {

    return (
        <div className={`flex flex-col gap-2 ${!isRoot ? "ml-9" : ""}`}>
            {
                nodes.map((node, idx) => {
                    const isLast = idx === nodes.length - 1;
                    const nextPipes = [...depthPipes, !isLast];

                    return (
                        <div key={node.id}>
                            <TreeRow node={node} pipes={depthPipes} isLast={isLast} isOpen={openIds.has(node.id)} toggleOpen={toggleOpen} />

                            {node.kind === "dir" && openIds.has(node.id) && node.children?.length ? (
                                <div>
                                    <ExplorerTree nodes={node.children} depthPipes={nextPipes} isRoot={false} openIds={openIds} toggleOpen={toggleOpen} />
                                </div>
                            ) : null}
                        </div>
                    );
                })
            }
        </div>
    );
}

function TreeRow({ node, pipes, isLast, isOpen, toggleOpen, }: { node: FsNode; pipes: boolean[]; isLast: boolean; isOpen: boolean; toggleOpen: (e: React.MouseEvent, node: FsNode) => void; }) {
    return (
        <div className="tree-row" onClick={(e) => toggleOpen(e, node)}>
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
                {node.kind === "dir" ? (isOpen ? (<img className="w-7 h-7" src={openDirectoryIcon} />) : (<img className="w-6 h-6" src={directoryIcon} />)) : null}
                <span className="tree-label truncate">{node.name}</span>
            </div>
        </div>
    );
}

export default ExplorerTree
