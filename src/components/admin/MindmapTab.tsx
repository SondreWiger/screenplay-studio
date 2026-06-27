'use client';

import { useEffect, useRef, useState } from 'react';

interface Member {
  role?: string;
  user_id?: string;
  profile?: { id: string; display_name: string | null; email: string; avatar_url: string | null } | null;
}

interface ProjectWithMembers {
  id: string;
  title: string;
  logline: string | null;
  script_type: string | null;
  format: string;
  status: string;
  created_at: string;
  updated_at: string;
  project_members: Member[];
  scripts: { count: number }[];
}

interface MindmapNode {
  id: string;
  type: 'project' | 'user';
  label: string;
  size: number;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  meta: {
    logline?: string | null;
    format?: string;
    status?: string;
    email?: string;
    role?: string;
    memberCount?: number;
    scriptsCount?: number;
  };
}

interface MindmapLink {
  sourceId: string;
  targetId: string;
}

export function MindmapTab({ projects }: { projects: ProjectWithMembers[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [links, setLinks] = useState<MindmapLink[]>([]);
  const [hoveredNode, setHoveredNode] = useState<MindmapNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<MindmapNode | null>(null);

  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize nodes and links
  useEffect(() => {
    const width = containerRef.current?.clientWidth || 800;
    const height = 500;

    const tempNodes: MindmapNode[] = [];
    const tempLinks: MindmapLink[] = [];

    // Map to keep track of user profiles (to merge duplicates across projects)
    const userNodesMap = new Map<string, { id: string; name: string; email: string }>();

    // Step 1: Create project nodes
    projects.forEach((proj, index) => {
      const memberCount = proj.project_members?.length || 0;
      const scriptsCount = proj.scripts?.[0]?.count || 0;

      // Project sizing logic: Cap the massive node scaling so the map remains navigable
      const size = Math.min(100, 24 + (memberCount * 12) + (scriptsCount * 3));

      // Distribute projects in a wide circle initially
      const angle = (index / projects.length) * Math.PI * 2;
      const startRadius = 150 + Math.random() * 50;

      const projNode: MindmapNode = {
        id: `proj-${proj.id}`,
        type: 'project',
        label: proj.title || 'Untitled Project',
        size,
        color: 'rgb(var(--brand-500))',
        x: width / 2 + Math.cos(angle) * startRadius,
        y: height / 2 + Math.sin(angle) * startRadius,
        vx: 0,
        vy: 0,
        meta: {
          logline: proj.logline,
          format: proj.format,
          status: proj.status,
          memberCount,
          scriptsCount
        }
      };
      tempNodes.push(projNode);

      // Step 2: Extract members and create associations
      proj.project_members?.forEach((member) => {
        if (!member.profile?.id) return;
        const profile = member.profile;

        const userId = profile.id;
        const displayName = profile.display_name || profile.email.split('@')[0] || 'Unknown User';

        if (!userNodesMap.has(userId)) {
          userNodesMap.set(userId, {
            id: `user-${userId}`,
            name: displayName,
            email: profile.email
          });
        }

        // Add a link from project to user
        tempLinks.push({
          sourceId: `proj-${proj.id}`,
          targetId: `user-${userId}`
        });
      });
    });

    // Step 3: Add unique user nodes
    userNodesMap.forEach((user, userId) => {
      // Place users orbiting randomly around center
      const angle = Math.random() * Math.PI * 2;
      const radius = 180 + Math.random() * 80;

      tempNodes.push({
        id: user.id,
        type: 'user',
        label: user.name,
        size: 16,
        color: '#6366f1', // Indigo accent
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        meta: {
          email: user.email
        }
      });
    });

    setNodes(tempNodes);
    setLinks(tempLinks);
  }, [projects]);

  // Physics Simulation Loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const width = containerRef.current?.clientWidth || 800;
    const height = 550;

    const tick = () => {
      setNodes((currentNodes) => {
        // Physics constants
        const gravity = 0.015;
        const repulsion = 4000;
        const springLength = 120;
        const springStrength = 0.04;
        const friction = 0.8;

        // Clone nodes to update positions
        const nextNodes = currentNodes.map((n) => ({ ...n }));

        // 1. Repulsion between all nodes
        for (let i = 0; i < nextNodes.length; i++) {
          const nodeA = nextNodes[i];
          for (let j = i + 1; j < nextNodes.length; j++) {
            const nodeB = nextNodes[j];
            let dx = nodeB.x - nodeA.x;
            let dy = nodeB.y - nodeA.y;
            
            // If nodes are exactly overlapping, apply small random jitter
            if (dx === 0 && dy === 0) {
              dx = Math.random() * 2 - 1;
              dy = Math.random() * 2 - 1;
            }

            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 400) {
              // Clamp distance to a minimum of 40px to prevent infinite/extreme forces
              const clampedDistance = Math.max(distance, 40);
              const force = repulsion / (clampedDistance * clampedDistance);
              const fx = (dx / clampedDistance) * force;
              const fy = (dy / clampedDistance) * force;

              nodeA.vx -= fx;
              nodeA.vy -= fy;
              nodeB.vx += fx;
              nodeB.vy += fy;
            }
          }
        }

        // 2. Spring force along links
        links.forEach((link) => {
          const source = nextNodes.find((n) => n.id === link.sourceId);
          const target = nextNodes.find((n) => n.id === link.targetId);

          if (source && target) {
            let dx = target.x - source.x;
            let dy = target.y - source.y;
            
            if (dx === 0 && dy === 0) {
              dx = Math.random() * 2 - 1;
              dy = Math.random() * 2 - 1;
            }

            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = distance - springLength;

            const fx = (dx / distance) * displacement * springStrength;
            const fy = (dy / distance) * displacement * springStrength;

            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
          }
        });

        // 3. Gravity towards center & update positions
        const centerX = width / 2;
        const centerY = height / 2;

        nextNodes.forEach((node) => {
          // Attract to center
          const dx = centerX - node.x;
          const dy = centerY - node.y;
          node.vx += dx * gravity;
          node.vy += dy * gravity;

          // Apply velocity and friction
          node.x += node.vx;
          node.y += node.vy;
          node.vx *= friction;
          node.vy *= friction;

          // (Boundaries removed for infinite pan/zoom canvas, center gravity handles clustering)
        });

        return nextNodes;
      });

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [links, nodes.length]);

  return (
    <div className="flex flex-col gap-6 w-full min-w-0" style={{ width: '100%' }}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white">Project Network Overview</h2>
          <p className="text-xs text-surface-400 mt-1">
            Glow sizes scale with project volume (scripts) and collaboration activity (active members).
          </p>
        </div>
        <div className="flex gap-4 font-mono text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgb(var(--brand-500))' }} />
            <span className="text-white/60">PROJECT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <span className="text-white/60">USER / MEMBER</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', width: '100%' }}>
        {/* Mind Map Canvas Area */}
        <div
          ref={containerRef}
          style={{ flex: '1 1 600px', minWidth: 0, cursor: isDragging ? 'grabbing' : 'grab' }}
          className="h-[550px] border border-surface-800 bg-surface-900/50 rounded-xl relative overflow-hidden select-none"
          onWheel={(e) => {
            const zoomSensitivity = 0.002;
            const delta = e.deltaY * zoomSensitivity;
            setTransform(t => ({ ...t, k: Math.max(0.1, Math.min(t.k - delta, 5)) }));
          }}
          onMouseDown={(e) => {
            setIsDragging(true);
            dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
          }}
          onMouseMove={(e) => {
            if (!isDragging) return;
            setTransform(t => ({ ...t, x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y }));
          }}
          onMouseUp={() => setIsDragging(false)}
          onMouseLeave={() => setIsDragging(false)}
        >
          <svg className="w-full h-full">
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
            {/* Draw Links */}
            {links.map((link, idx) => {
              const source = nodes.find((n) => n.id === link.sourceId);
              const target = nodes.find((n) => n.id === link.targetId);
              if (!source || !target) return null;

              const isLinkActive =
                hoveredNode?.id === source.id ||
                hoveredNode?.id === target.id ||
                selectedNode?.id === source.id ||
                selectedNode?.id === target.id;

              return (
                <line
                  key={`${link.sourceId}-${link.targetId}-${idx}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={isLinkActive ? 'rgb(var(--brand-500))' : 'rgba(255, 255, 255, 0.05)'}
                  strokeWidth={isLinkActive ? 1.5 : 0.8}
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Draw Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                >
                  {/* Node Glow / Ring */}
                  <circle
                    r={node.size + 6}
                    fill="none"
                    stroke={node.type === 'project' ? 'rgb(var(--brand-500))' : '#6366f1'}
                    strokeWidth={isSelected || isHovered ? 2 : 1}
                    className="transition-all duration-300"
                    opacity={isSelected ? 0.8 : isHovered ? 0.5 : 0.1}
                  />

                  {/* Core Node Circle */}
                  <circle
                    r={node.size}
                    fill={node.type === 'project' ? 'rgba(var(--brand-500), 0.2)' : 'rgba(99, 102, 241, 0.2)'}
                    stroke={node.type === 'project' ? 'rgb(var(--brand-500))' : '#6366f1'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="transition-all duration-200"
                  />

                  {/* Icon label initials inside circle */}
                  <text
                    textAnchor="middle"
                    dy=".3em"
                    fill="#fff"
                    className="text-[9px] font-mono font-bold select-none pointer-events-none"
                    opacity={node.size > 20 ? 0.9 : 0}
                  >
                    {node.label.slice(0, 3).toUpperCase()}
                  </text>

                  {/* Exterior Text Label */}
                  <text
                    y={node.size + 16}
                    textAnchor="middle"
                    fill="#fff"
                    className="text-[10px] font-mono tracking-wider select-none pointer-events-none"
                    opacity={isHovered || isSelected || node.type === 'project' ? 0.9 : 0.4}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
            </g>
          </svg>
        </div>

        {/* Readout Sidepanel */}
        <div 
          style={{ flex: '0 1 350px', minWidth: '300px' }}
          className="border border-surface-800 bg-surface-900/50 p-6 rounded-xl min-h-[380px] flex flex-col justify-between"
        >
          {selectedNode || hoveredNode ? (
            (() => {
              const active = selectedNode || hoveredNode;
              const isProj = active?.type === 'project';
              return (
                <div className="flex flex-col gap-6">
                  {/* Header info */}
                  <div className="border-b border-surface-800 pb-3">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-surface-500">
                      {isProj ? 'Project Registry' : 'User Member Registry'}
                    </span>
                    <h3 className="text-base font-black text-white mt-1 uppercase tracking-wide">
                      {active?.label}
                    </h3>
                  </div>

                  {/* Detail list */}
                  <div className="space-y-4 font-mono text-[10px]">
                    {isProj ? (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">format</span>
                          <span className="col-span-2 text-white/80">{active?.meta.format || '—'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">status</span>
                          <span className="col-span-2 text-white/80">{active?.meta.status?.replace('_', ' ') || '—'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">members</span>
                          <span className="col-span-2 text-brand-400 font-bold">{active?.meta.memberCount} active</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">scripts</span>
                          <span className="col-span-2 text-white/80">{active?.meta.scriptsCount} draft(s)</span>
                        </div>
                        <div className="border-t border-surface-800/50 pt-4 mt-2">
                          <span className="block text-[8px] uppercase tracking-widest text-surface-500 mb-1">synopsis / logline</span>
                          <p className="text-[11px] text-surface-300 leading-relaxed font-light">
                            {active?.meta.logline || 'No logline registered.'}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">email</span>
                          <span className="col-span-2 text-white/80">{active?.meta.email}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-surface-500 uppercase tracking-wider">node_type</span>
                          <span className="col-span-2 text-indigo-400 font-bold">USER_PROFILE</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-16 text-surface-500">
              <span className="text-2xl mb-2">🕸️</span>
              <p className="text-xs font-mono">Select or hover a node on the mind map to view connection statistics.</p>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-surface-800 flex justify-between font-mono text-[9px] text-surface-500">
            <span>GRID_NODE: ACTIVE</span>
            <span>FORCE_INDEX: 0.85</span>
          </div>
        </div>
      </div>
    </div>
  );
}
