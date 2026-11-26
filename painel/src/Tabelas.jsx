// Aba "Tabelas" (26/11/2026, protótipo aprovado): um cartão por MODELO (PS5, GTA 6, acessórios, SSD) com uma linha
// por variante (meta, melhor agora, parcelado, menor já visto, distância da meta). Tocar na variante abre as lojas,
// cada uma com o link do anúncio. No modelo do gift card vão também os cartões com desconto. As TVs (escondidas com
// "tvs_desligadas" no latest) continuam no topo quando ligadas.
import {useState} from 'react';
import {TableCell, TableRow} from './tremor.js';
import {agrupaPorModelo} from './logica.js';
import {
  Abrir,
  Chip,
  CodigoCupom,
  Fato,
  GraficoHistorico,
  H2,
  H3,
  LinkFora,
  Logo,
  Nota,
  Sub,
  Tabela,
  TabelaLojas,
} from './componentes.jsx';

const temPreco = r => r.melhor.v !== '—';
const distCls = d => (d.v === '—' ? 'sem' : d.ok ? 'abaixo' : 'acima');
// linha de loja que conta como "oferta agora": nem suspeita nem de coleta antiga
const ativa = l => l.classe !== 'sus' && l.classe !== 'velho';

export default function Tabelas({vm}) {
  const resumo = vm.familias.flatMap(f => f.resumo);
  const produtos = Object.fromEntries(vm.familias.flatMap(f => f.produtos).map(p => [p.id, p]));
  const gift = vm.familias.map(f => f.gift).find(Boolean) || null;
  const modelos = agrupaPorModelo(resumo, temPreco);
  const [filtro, setFiltro] = useState('todos');
  // abre a primeira variante com oferta, para mostrar que a linha abre
  const [aberto, setAberto] = useState(() => {
    const r = modelos[0]?.itens.find(temPreco);
    return r ? {[r.id]: true} : {};
  });
  const troca = id => setAberto(a => ({...a, [id]: !a[id]}));
  return (
    <>
      {vm.tvs && <TVs tvs={vm.tvs} />}
      <section className="tab-cab">
        <div>
          <h2 className="tit cond">Tabelas de preços</h2>
          <p className="sub">
            Todas as ofertas válidas da coleta de {vm.quando}, por modelo e variante. Toque numa variante para abrir as
            lojas.
          </p>
        </div>
        <div className="chips" role="group" aria-label="Filtrar por modelo">
          {[{id: 'todos', nome: 'Todos'}, ...modelos].map(m => (
            <button
              key={m.id}
              type="button"
              aria-pressed={filtro === m.id}
              onClick={() => setFiltro(m.id)}
              className={`chip${filtro === m.id ? ' on' : ''}`}
            >
              {m.nome}
            </button>
          ))}
        </div>
      </section>
      {modelos
        .filter(m => filtro === 'todos' || filtro === m.id)
        .map((m, i) => (
          <Modelo
            key={filtro + m.id}
            m={m}
            atraso={i * 70}
            produtos={produtos}
            aberto={aberto}
            onTroca={troca}
            gift={m.itens.some(r => r.id === 'GIFT_CARD_PSN') ? gift : null}
          />
        ))}
      <Nota>
        Metas aprovadas em 03/10 (Pix / total parcelado sem juros). Kit e edição especial: meta do console-base mais o
        valor do extra; gift card: 15% de desconto ou mais em loja oficial, em cartão de R$ 100 ou mais.
      </Nota>
    </>
  );
}

function Modelo({m, atraso, produtos, aberto, onTroca, gift}) {
  const com = m.itens.filter(temPreco).length;
  return (
    <section className="cartao modelo entra" style={{animationDelay: `${atraso}ms`}} aria-label={m.nome}>
      <div className="cab">
        <div>
          <p className="rotulo">Modelo</p>
          <h2 className="tit cond">{m.nome}</h2>
          <p className="sub">
            {m.itens.length > 1
              ? `${m.itens.length} variantes, ${com} com oferta agora`
              : com
                ? 'Com oferta agora'
                : 'Sem oferta agora'}
          </p>
        </div>
      </div>
      <div className="tv-cab" aria-hidden="true">
        <span>Variante</span>
        <span className="tv-opc">Meta</span>
        <span>Melhor agora</span>
        <span className="tv-opc">Parcelado</span>
        <span className="tv-opc">Menor já visto</span>
        <span>Distância da meta</span>
      </div>
      {m.itens.map(r => (
        <Variante key={r.id} r={r} p={produtos[r.id]} aberto={!!aberto[r.id]} onTroca={() => onTroca(r.id)} />
      ))}
      {gift && (
        <div className="bloco-extra">
          <Gift g={gift} />
        </div>
      )}
    </section>
  );
}

function Variante({r, p, aberto, onTroca}) {
  const linhas = p?.linhas || [];
  const n = linhas.filter(ativa).length;
  return (
    <div className={`tv${aberto ? ' aberto' : ''}${temPreco(r) ? '' : ' apagada'}`}>
      <button type="button" className="tvar" aria-expanded={aberto} onClick={onTroca}>
        <span className="tv-nome">
          <svg
            className="seta"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
          <span className="nm">
            <b>{r.variante}</b>
            <small>
              {n ? `${n} ${n === 1 ? 'oferta agora' : 'ofertas agora'}` : 'sem oferta agora'}
              {r.sub ? ` · ${r.sub}` : ''}
            </small>
          </span>
        </span>
        <span className="tv-c tv-opc">
          {r.meta.v}
          {r.meta.subs.map((s, i) => (
            <small key={i}>{s}</small>
          ))}
        </span>
        <span className="tv-c tv-melhor">
          <b>{r.melhor.v}</b>
          {r.melhor.sub && <small>{r.melhor.sub}</small>}
        </span>
        <span className="tv-c tv-opc">
          {r.parc.v}
          {r.parc.sub && <small>{r.parc.sub}</small>}
        </span>
        <span className="tv-c tv-opc">
          {r.min.v}
          {r.min.sub && <small>{r.min.sub}</small>}
        </span>
        <span className="tv-c">
          <span className={`dist-pill ${distCls(r.dist)}`}>{r.dist.v === '—' ? 'sem oferta' : r.dist.v}</span>
        </span>
      </button>
      {aberto && <Lojas linhas={linhas} r={r} />}
    </div>
  );
}

// as lojas da variante: Pix (e com cupom), à vista, parcelado e o link do anúncio; as 8 primeiras e um botão para o resto
function Lojas({linhas, r}) {
  const [todas, setTodas] = useState(false);
  if (!linhas.length)
    return (
      <div className="tlojas">
        <p className="tl-mais">
          Nenhuma loja com esta variante agora.
          {r.min.v !== '—' && ` O menor já visto foi ${r.min.v}${r.min.sub ? ` (${r.min.sub})` : ''}.`}
        </p>
      </div>
    );
  const vis = todas ? linhas : linhas.slice(0, 8);
  return (
    <div className="tlojas">
      <div className="tl-cab" aria-hidden="true">
        <span>Loja</span>
        <span>Pix</span>
        <span className="tl-av">À vista</span>
        <span className="tl-parc">Parcelado</span>
        <span />
      </div>
      {vis.map((l, i) => (
        <div key={i} className={`tl${l.classe === 'best' ? ' top' : ''}${ativa(l) ? '' : ' fraca'}`}>
          <div className="tl-loja">
            <span>
              <Logo loja={l.loja} className="h-[22px] max-w-[96px]" />
              {l.classe === 'best' && <span className="selo">mais barata</span>}
              {l.selo && (
                <span className={`selo ${l.selo.tipo === 'risco' ? 'risco' : 'novo'}`} title={l.selo.titulo}>
                  {l.selo.rotulo}
                </span>
              )}
              {l.classe === 'sus' && <span className="selo risco">suspeita</span>}
              {l.velho && <span className="selo novo">coleta antiga</span>}
            </span>
            {l.vendedor && <small>vendido por {l.vendedor}</small>}
            {l.oferta && <small>{l.oferta}</small>}
            {l.info.map((t, j) => (
              <small key={j}>{t}</small>
            ))}
            {l.cupom && (
              <small>
                cupom <CodigoCupom codigo={l.cupom} />
              </small>
            )}
            <small>
              {l.fonte}
              {l.agregador ? ' (agregador)' : ''} · visto em {l.visto}
            </small>
          </div>
          <div className="tl-pix">
            <b className={l.classe === 'sus' ? 'line-through' : ''}>{l.pix}</b>
            {l.pixCupom && <small>c/ cupom {l.pixCupom}</small>}
          </div>
          <div className="tl-av">{l.avista}</div>
          <div className="tl-parc">
            {l.parc ? (
              <>
                <b className="text-tinta">{l.parc.total}</b>
                {l.parc.melhor && <span className="selo">melhor parcelado</span>}
                <small>{l.parc.texto}</small>
              </>
            ) : (
              l.parcTexto
            )}
          </div>
          <div className="tl-link">
            <LinkFora
              url={l.url}
              aria={`Abrir o anúncio na ${l.loja}${l.vendedor ? `, vendido por ${l.vendedor}` : ''} (abre em outra aba)`}
            >
              Ver anúncio
            </LinkFora>
          </div>
        </div>
      ))}
      {linhas.length > 8 && (
        <p className="tl-mais">
          <button type="button" onClick={() => setTodas(t => !t)}>
            {todas ? 'Mostrar só as 8 mais baratas' : `Ver todas as ${linhas.length} ofertas`}
          </button>
        </p>
      )}
    </div>
  );
}

const Grade = ({cols, children}) => <div className={`grid grid-cols-2 gap-2 ${cols}`}>{children}</div>;

function TVs({tvs}) {
  const {
    alvos,
    modelos: {'55C6K': m55, '65C6K': m65},
    dif,
  } = tvs;
  const Cel = ({c}) =>
    !c ? (
      '—'
    ) : (
      <>
        <b className="text-tinta">{c.v}</b>
        {c.subs.map((s, i) => (
          <Sub key={i}>{s}</Sub>
        ))}
        {c.velho && (
          <>
            {' '}
            <Chip tipo="warn">antigo</Chip>
          </>
        )}
      </>
    );
  return (
    <>
      <p className="mb-4 mt-6 max-w-[72ch] text-base text-tinta-2">
        TVs QD-Mini LED. Alvos da 55C6K: Pix {alvos['55C6K'].pix} · parcelado {alvos['55C6K'].parcelado}. Alvos da
        65C6K: Pix {alvos['65C6K'].pix} · parcelado {alvos['65C6K'].parcelado}.
      </p>
      <H3>
        <Chip tipo="m55">55"</Chip> TCL 55C6K
      </H3>
      <Grade cols="md:grid-cols-3">
        <Fato k="Melhor à vista agora" d={m55.destaques.melhor} />
        <Fato k="Melhor parcelado agora" d={m55.destaques.parc} />
        <Fato k="Menor já visto" d={m55.destaques.min} />
      </Grade>
      <H3>
        <Chip tipo="m65">65"</Chip> TCL 65C6K
      </H3>
      <Grade cols="md:grid-cols-5">
        <Fato k="Melhor à vista agora" d={m65.destaques.melhor} />
        <Fato k="Melhor parcelado agora" d={m65.destaques.parc} />
        <Fato k="Menor já visto" d={m65.destaques.min} />
        <Fato k='65" a mais · à vista' d={dif.pix} />
        <Fato k='65" a mais · parcelado' d={dif.parc} />
      </Grade>

      <H2>55" × 65" por loja</H2>
      <Tabela
        cab={[
          'Loja',
          '55" à vista',
          '65" à vista',
          '65" a mais · à vista',
          '55" parcelado (total)',
          '65" parcelado (total)',
          '65" a mais · parcelado',
        ]}
      >
        {tvs.comparar.length ? (
          tvs.comparar.map(l => (
            <TableRow key={l.loja}>
              <TableCell>
                <b className="text-tinta">{l.loja}</b>
              </TableCell>
              {l.celulas.map((c, i) => (
                <TableCell key={i} className={i % 3 === 2 ? 'bg-mudo font-bold text-tinta' : ''}>
                  {i % 3 === 2 ? c : <Cel c={c} />}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-tinta-3">
              Nenhum preço de loja ainda.
            </TableCell>
          </TableRow>
        )}
      </Tabela>
      <Nota>
        Menor preço de cada TV na mesma loja (Pix/à vista e total do parcelamento), entre as coletas recentes; a
        diferença é quanto a 65" custa a mais que a 55" ali.
      </Nota>

      {[
        ['55C6K', m55],
        ['65C6K', m65],
      ].map(([id, m]) => (
        <div key={id}>
          <H2>Ofertas da {id}</H2>
          <TabelaLojas linhas={m.linhas} vazio={`Nenhum preço de loja da ${id} ainda.`} />
          <H2>Histórico da {id}</H2>
          <div className="rounded-[3px] border-2 border-linha bg-superficie p-3">
            <GraficoHistorico serie={m.serie} alvo={m.alvo} />
          </div>
        </div>
      ))}
    </>
  );
}

function Gift({g}) {
  const {regra, melhor: m} = g;
  return (
    <>
      <H3>Gift card PlayStation</H3>
      {!m ? (
        <Nota>
          Nenhum gift card com desconto em loja oficial agora (PS Store, Hype, Nuuvem, loja oficial PlayStation no
          Mercado Livre, ou vendido pela própria KaBuM, Americanas, Amazon ou Magalu). Meta: {regra.meta} de desconto ou
          mais.
        </Nota>
      ) : (
        <>
          <p className="mb-4 max-w-[72ch] text-base text-tinta-2">
            Melhor agora: <b className="text-tinta">{m.preco}</b> pelo cartão de <b className="text-tinta">{m.face}</b>{' '}
            ({m.desconto} de desconto) · {m.loja}
            {m.post && ' · postagem'}
            {m.cupom && (
              <>
                {' '}
                · cupom <CodigoCupom codigo={m.cupom} />
              </>
            )}
            {m.url && (
              <>
                {' '}
                · <Abrir url={m.url} />
              </>
            )}
            {m.naMeta && (
              <>
                {' '}
                <Chip tipo="ok">na meta</Chip>
              </>
            )}
          </p>
          {g.cartoes.length > 0 && (
            <Tabela className="mt-2" cab={['Loja', 'Valor de face', 'Preço', 'Desconto', '']}>
              {g.cartoes.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <b className="text-tinta">{c.loja}</b>
                    {c.post && <Sub>postagem</Sub>}
                  </TableCell>
                  <TableCell>{c.face}</TableCell>
                  <TableCell>
                    <b className="text-tinta">{c.preco}</b>
                  </TableCell>
                  <TableCell className={c.naMeta ? 'text-ok' : ''}>{c.desconto}</TableCell>
                  <TableCell>
                    <Abrir url={c.url} />
                  </TableCell>
                </TableRow>
              ))}
            </Tabela>
          )}
          <Nota>
            Só cartão [Exclusivo Brasil] de loja oficial. Meta: {regra.meta} de desconto ou mais (🔥 a partir de{' '}
            {regra.excelente}).
          </Nota>
        </>
      )}
    </>
  );
}
