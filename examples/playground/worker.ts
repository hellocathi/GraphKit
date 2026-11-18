import { calculateDagreLayout } from '@your-scope/graphkit/layout';
import type { LayoutInput } from '@your-scope/graphkit/layout';

self.addEventListener('message', (event: MessageEvent<LayoutInput>) => {
  self.postMessage(calculateDagreLayout(event.data));
});
