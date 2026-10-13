/**
 * One reference topic: `/reference/:topic`. The topic pages are static imports so a navigation shows a
 * finished page and the shell can place focus on its heading straight away; being their own route, they
 * load before the location changes (the router's `lazy`) and the index page at `/reference` does not carry
 * them. The Orbit and Agents pages keep their frame static and load their sections as a separate chunk.
 */

import { useParams } from 'react-router';
import { NotFoundView } from '@/app/NotFoundView';
import { topicById } from '@/content/reference';
import AgentsPage from '../reference/pages/AgentsPage';
import ApiPage from '../reference/pages/ApiPage';
import DockerPage from '../reference/pages/DockerPage';
import NetworkingPage from '../reference/pages/NetworkingPage';
import OrbitPage from '../reference/pages/OrbitPage';
import SpecPage from '../reference/pages/SpecPage';

export default function ReferenceTopic() {
  const { topic } = useParams();
  const meta = topic ? topicById(topic) : undefined;
  if (!meta) {
    return (
      <NotFoundView
        title="That reference page does not exist"
        body="The reference has six pages: the application spec, networking, Docker practices, the API cheat sheet, Orbit and Git deploys, and agents and MCP."
        documentTitle="Reference page not found"
      />
    );
  }
  switch (meta.id) {
    case 'spec':
      return <SpecPage />;
    case 'networking':
      return <NetworkingPage />;
    case 'docker':
      return <DockerPage />;
    case 'api':
      return <ApiPage />;
    case 'orbit':
      return <OrbitPage />;
    case 'agents':
      return <AgentsPage />;
    default:
      return null;
  }
}
