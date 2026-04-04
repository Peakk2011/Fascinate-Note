import { getState } from '../utils/config.js';

export class MissionLayout {
    constructor(missionView) {
        this.missionView = missionView;
        this.board = missionView.board;
        this.windowManager = missionView.windowManager;
    }
    
    layoutWindows(visible) {
        const count = visible.length;
        const containerW = this.board.container.offsetWidth;
        const containerH = this.board.container.offsetHeight;
        const state = getState();
        const viewScale = state?.scale || 1;
        const viewPanX = state?.panX || 0;
        const viewPanY = state?.panY || 0;
        const insetX = Math.max(16, Math.min(36, Math.round(containerW * 0.03)));
        const insetY = Math.max(18, Math.min(42, Math.round(containerH * 0.04)));
        const gapX = Math.max(10, Math.min(18, Math.round(containerW * 0.012)));
        const gapY = Math.max(12, Math.min(22, Math.round(containerH * 0.016)));
        const availableWidth = Math.max(containerW - (insetX * 2), 1);
        const availableHeight = Math.max(containerH - (insetY * 2), 1);
        const createRows = (columns) => {
            const rows = [];

            for (let start = 0; start < visible.length; start += columns) {
                const items = visible.slice(start, start + columns);
                rows.push({
                    items,
                    baseWidth: items.reduce((sum, win) => sum + Math.max(win.width, 1), 0),
                    baseHeight: items.reduce((maxHeight, win) => Math.max(maxHeight, Math.max(win.height, 1)), 0)
                });
            }

            return rows;
        };
        const getCandidateLayout = (columns) => {
            const rows = createRows(columns);
            if (!rows.length) return null;

            const widthScaleLimit = rows.reduce((smallestScale, row) => {
                const gapBudget = gapX * Math.max(row.items.length - 1, 0);
                const usableWidth = Math.max(availableWidth - gapBudget, 1);
                return Math.min(smallestScale, usableWidth / Math.max(row.baseWidth, 1));
            }, 1);
            const totalBaseHeight = rows.reduce((sum, row) => sum + row.baseHeight, 0);
            const totalGapY = gapY * Math.max(rows.length - 1, 0);
            const heightScaleLimit = Math.max(availableHeight - totalGapY, 1) / Math.max(totalBaseHeight, 1);
            const viewportScale = Math.min(1, widthScaleLimit, heightScaleLimit);

            if (viewportScale <= 0) return null;

            const scaledRowWidths = rows.map(row => {
                const gapBudget = gapX * Math.max(row.items.length - 1, 0);
                return (row.baseWidth * viewportScale) + gapBudget;
            });
            const scaledRowHeights = rows.map(row => row.baseHeight * viewportScale);
            const contentWidth = Math.max(...scaledRowWidths);
            const contentHeight = scaledRowHeights.reduce((sum, height) => sum + height, 0) + totalGapY;

            return {
                columns,
                rows,
                viewportScale,
                contentWidth,
                contentHeight,
                compactness: contentWidth * contentHeight
            };
        };

        let bestLayout = null;

        for (let columns = 1; columns <= count; columns += 1) {
            const candidate = getCandidateLayout(columns);
            if (!candidate) continue;

            if (!bestLayout) {
                bestLayout = candidate;
                continue;
            }

            const scaleDiff = candidate.viewportScale - bestLayout.viewportScale;
            if (scaleDiff > 0.0001) {
                bestLayout = candidate;
                continue;
            }

            if (Math.abs(scaleDiff) <= 0.0001 && candidate.compactness < bestLayout.compactness) {
                bestLayout = candidate;
            }
        }

        if (!bestLayout) return;

        const scale = bestLayout.viewportScale / viewScale;
        let currentY = (containerH - bestLayout.contentHeight) * 0.5;

        bestLayout.rows.forEach((row) => {
            const rowScaledWidth = (row.baseWidth * bestLayout.viewportScale) + (gapX * Math.max(row.items.length - 1, 0));
            const rowScaledHeight = row.baseHeight * bestLayout.viewportScale;
            let currentX = (containerW - rowScaledWidth) * 0.5;

            row.items.forEach((win) => {
                const el = this.windowManager.windowMap.get(win.id);
                if (!el) return;

                const scaledW = win.width * bestLayout.viewportScale;
                const scaledH = win.height * bestLayout.viewportScale;
                const targetX = currentX;
                const targetY = currentY + ((rowScaledHeight - scaledH) * 0.5);

                const dx = ((targetX - viewPanX) / viewScale) - win.x;
                const dy = ((targetY - viewPanY) / viewScale) - win.y;
                
                el._missionTransform = { dx, dy, scale };
                
                el.style.transition = 'transform 400ms cubic-bezier(0.25, 0.1, 0.25, 1)';
                el.style.transformOrigin = '0 0';
                el.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
                el.classList.add('is-mission');
                el.classList.toggle('is-mission-single', count === 1);
                currentX += scaledW + gapX;
            });

            currentY += rowScaledHeight + gapY;
        });
    }
}
