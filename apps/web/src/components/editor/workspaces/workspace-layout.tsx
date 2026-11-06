"use client";

import { useMemo } from "react";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { Timeline } from "@/timeline/components";
import { PreviewPanel } from "@/preview/components";
import { usePasteMedia } from "@/media/use-paste-media";
import { useEditor } from "@/editor/use-editor";
import {
	createPreviewOverlayControl,
	isPreviewOverlayVisible,
	mergePreviewOverlaySources,
} from "@/preview/overlays";
import { usePreviewStore } from "@/preview/preview-store";
import { getGuidePreviewOverlaySource } from "@/guides";
import {
	bookmarkNotesPreviewOverlay,
	getBookmarkPreviewOverlaySource,
} from "@/timeline/bookmarks/index";
import { MixerPanel } from "./mixer-panel";
import { getPreset } from "./presets";
import { useWorkspaceStore } from "./workspace-store";

export function WorkspaceLayout() {
	usePasteMedia();
	const workspace = useWorkspaceStore((s) => s.active);
	const sizes = useWorkspaceStore((s) => s.sizes[s.active]);
	const setSize = useWorkspaceStore((s) => s.setSize);
	const preset = getPreset(workspace);
	const activeScene = useEditor((editor) =>
		editor.scenes.getActiveSceneOrNull(),
	);
	const currentTime = useEditor((editor) => editor.playback.getCurrentTime());
	const activeGuide = usePreviewStore((state) => state.activeGuide);
	const overlays = usePreviewStore((state) => state.overlays);
	const setOverlayVisibility = usePreviewStore(
		(state) => state.setOverlayVisibility,
	);
	const showBookmarkNotes = isPreviewOverlayVisible({
		overlay: bookmarkNotesPreviewOverlay,
		overlays,
	});

	const overlaySource = useMemo(
		() =>
			mergePreviewOverlaySources({
				sources: [
					getGuidePreviewOverlaySource({
						guideId: activeGuide,
					}),
					activeScene
						? getBookmarkPreviewOverlaySource({
								bookmarks: activeScene.bookmarks,
								time: currentTime,
								isVisible: showBookmarkNotes,
							})
						: {
								definitions: [bookmarkNotesPreviewOverlay],
								instances: [],
							},
				],
			}),
		[activeGuide, activeScene, currentTime, showBookmarkNotes],
	);

	const overlayControls = useMemo(
		() =>
			overlaySource.definitions.map((overlay) =>
				createPreviewOverlayControl({ overlay, overlays }),
			),
		[overlaySource.definitions, overlays],
	);

	const side = preset.side === "mixer" ? <MixerPanel /> : <PropertiesPanel />;

	return (
		<ResizablePanelGroup
			key={workspace}
			direction="vertical"
			className="size-full gap-[0.18rem]"
			data-workspace={workspace}
			onLayout={(layout) => {
				setSize({ id: workspace, key: "mainContent", size: layout[0] ?? sizes.mainContent });
				setSize({ id: workspace, key: "timeline", size: layout[1] ?? sizes.timeline });
			}}
		>
			<ResizablePanel
				id="main"
				order={1}
				defaultSize={sizes.mainContent}
				minSize={30}
				maxSize={85}
				className="min-h-0"
			>
				<ResizablePanelGroup
					direction="horizontal"
					className="size-full gap-[0.19rem] px-3"
					onLayout={(layout) => {
						setSize({ id: workspace, key: "tools", size: layout[0] ?? sizes.tools });
						setSize({ id: workspace, key: "preview", size: layout[1] ?? sizes.preview });
						setSize({ id: workspace, key: "side", size: layout[2] ?? sizes.side });
					}}
				>
					<ResizablePanel
						id="tools"
						order={1}
						defaultSize={sizes.tools}
						minSize={15}
						maxSize={40}
						className="min-w-0"
					>
						<AssetsPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						id="preview"
						order={2}
						defaultSize={sizes.preview}
						minSize={30}
						className="min-h-0 min-w-0 flex-1"
					>
						<PreviewPanel
							overlayControls={overlayControls}
							overlayInstances={overlaySource.instances}
							onOverlayVisibilityChange={setOverlayVisibility}
						/>
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						id="side"
						order={3}
						defaultSize={sizes.side}
						minSize={15}
						maxSize={45}
						className="min-w-0"
					>
						{side}
					</ResizablePanel>
				</ResizablePanelGroup>
			</ResizablePanel>

			<ResizableHandle withHandle />

			<ResizablePanel
				id="timeline"
				order={2}
				defaultSize={sizes.timeline}
				minSize={15}
				maxSize={70}
				className="min-h-0 px-3 pb-3"
			>
				<Timeline />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
