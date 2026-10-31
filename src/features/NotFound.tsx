import { ButtonLink, Empty } from '@/ui'

export default function NotFound() {
  return <Empty icon="explore_off" title="Página não encontrada" sub="O endereço que abriu não existe." action={<ButtonLink to="/" variant="primary">Voltar a Hoje</ButtonLink>} />
}
