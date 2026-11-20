import { useParams } from 'react-router'
import { ButtonLink, Empty, ErrorState, Loading } from '@/ui'
import DocView from './DocView'
import { useHelpDoc } from './queries'
import { usePageTitle } from '@/lib/title'

export default function PlaybookPage() {
  const { id } = useParams()
  const { data: doc, isPending, isError, error, refetch } = useHelpDoc(id)
  usePageTitle(doc?.title)
  if (isPending) return <Loading />
  if (isError && !doc) return <ErrorState error={error} retry={() => refetch()} />
  if (!doc || doc.kind !== 'guide') return <Empty icon="menu_book" title="Guia não encontrado" action={<ButtonLink to="/help" variant="soft">Voltar à Ajuda</ButtonLink>} />
  return <DocView doc={doc} />
}
