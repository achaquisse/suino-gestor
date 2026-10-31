import { useParams } from 'react-router'
import { ButtonLink, Empty, ErrorState, Loading } from '@/ui'
import DocView from './DocView'
import { useHelpDoc } from './queries'

export default function ArticlePage() {
  const { id } = useParams()
  const { data: doc, isPending, isError, error, refetch } = useHelpDoc(id)
  if (isPending) return <Loading />
  if (isError && !doc) return <ErrorState error={error} retry={() => refetch()} />
  if (!doc || doc.kind !== 'article') return <Empty icon="article" title="Artigo não encontrado" action={<ButtonLink to="/help" variant="soft">Voltar à Ajuda</ButtonLink>} />
  return <DocView doc={doc} />
}
