import { labById } from '@shared/curriculum';
import { useParams } from 'react-router';
import { NotFoundView } from '@/app/NotFoundView';
import { LabHost } from './LabHost';
import { LabsIndex } from './LabsIndex';

/**
 * `/labs` is the index of instruments; `/labs/:labId` is one lab inside the shared frame. An id that is
 * not in the curriculum is a friendly not-found.
 */
export default function Labs() {
  const { labId } = useParams();
  if (!labId) return <LabsIndex />;
  const meta = labById(labId);
  if (!meta) {
    return (
      <NotFoundView
        title="That lab does not exist"
        body="Pick one of the labs from the index."
        documentTitle="Lab not found"
      />
    );
  }
  return <LabHost key={meta.id} labId={meta.id} />;
}
