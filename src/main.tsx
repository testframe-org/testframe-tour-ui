// The plugin's static entry point: the same TourApp the IDE renders, mounted on the bundle the
// plugin serves at /tour. The API base is the plugin's own tour API, same origin. `?project=` and
// `?env=` preselect, exactly as they do when the IDE opens the tour.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TourApp } from './index';

const container = document.getElementById('root');
if (!container) throw new Error('the tour bundle has no #root element');

const params = new URLSearchParams(window.location.search);

createRoot(container).render(
  <StrictMode>
    <TourApp apiBase="/api/v1/tour" project={params.get('project')} environment={params.get('env')} />
  </StrictMode>
);
