// Aba Produtos (26/11/2026, protótipo aprovado): uma pílula por MODELO no cabeçalho (PS5, GTA 6, acessórios, SSD) e,
// dentro do modelo, as variantes com o preço de cada uma. Da variante escolhida: o cartão do melhor preço (com o botão
// que abre o anúncio), a lista "onde comprar agora" (cada loja com o link do anúncio), o gráfico do preço por dia e a
// rosca de quem foi a mais barata. O período escolhido no gráfico vale para a lista e a rosca também.
import {useEffect, useMemo, useState} from 'react';
import {placar, reais, variacao7} from './logica.js';
import {Copiar, Grafico, LinkFora, Logo, Rosca, SetaFora, corDaPosicao, fotoDe} from './componentes.jsx';

const diaLocal = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const PERIODOS = [
  [7, '7 dias'],
  [30, '30 dias'],
  [0, 'Tudo'],
];
const css = v => `rgb(var(${v}))`;
// a loja com artigo: "na KaBuM!", "no Mercado Livre"
const naLoja = loja => (/^(mercado|magazine)/i.test(loja) ? 'no ' : 'na ') + loja;

// as pílulas dos modelos na faixa azul do topo; no celular rolam de lado numa linha só
export function Pilulas({modelos, atual, onModelo}) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-3 sm:px-6" role="group" aria-label="Modelos monitorados">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {modelos.map(m => {
          const on = m.id === atual?.modelo;
          const com = m.itens.filter(v => v.melhor);
          const menor = com.length ? com.reduce((a, b) => (b.melhor.valor < a.melhor.valor ? b : a)) : null;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => onModelo(m)}
              className={`pilula${on ? ' on' : ''}${menor ? '' : ' apagada'}`}
            >
              <i className={`ponto ${menor?.melhor.dist?.cls || 'sem'}`} aria-hidden="true" />
              <span>{m.curto}</span>
              <span className="pp">
                {menor ? (m.itens.length > 1 ? 'desde ' : '') + reais(menor.melhor.valor) : 'sem oferta'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Vitrine({it, modelo, onVariante}) {
  if (!it)
    return (
      <p className="py-3 text-base text-tinta-3">
        Nenhum preço coletado ainda. Os produtos aparecem aqui depois da primeira coleta.
      </p>
    );
  return (
    <>
      {modelo && modelo.itens.length > 1 && <Variantes modelo={modelo} atual={it} onVariante={onVariante} />}
      <Produto key={it.id} it={it} />
    </>
  );
}

// as variantes do modelo (sem item separado por variação): o preço de agora e a distância da meta de cada uma
function Variantes({modelo, atual, onVariante}) {
  const com = modelo.itens.filter(v => v.melhor).length;
  return (
    <section className="mb-5" aria-label="Variantes do modelo">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
        <h2 className="tit cond">{modelo.nome}</h2>
        <p className="sub m-0">
          {modelo.itens.length} variantes, {com} com oferta agora
        </p>
      </div>
      <div className="var-grade" role="group" aria-label="Escolha a variante">
        {modelo.itens.map(v => {
          const on = v.id === atual.id;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={on}
              onClick={() => onVariante(v.id)}
              className={`vt${on ? ' on' : ''}${v.melhor ? '' : ' apagada'}`}
            >
              <span className="v-nome">{v.variante}</span>
              <span className="v-preco cond">{v.melhor ? reais(v.melhor.valor) : 'sem oferta'}</span>
              <span className={`v-dist ${v.melhor?.dist?.cls || ''}`}>
                {v.melhor
                  ? v.melhor.dist?.txt || `em ${v.melhor.loja}`
                  : v.min
                    ? `menor já visto ${reais(v.min.valor)}`
                    : ''}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// true depois do primeiro quadro: as barras e a régua saem do zero e deslizam até o valor
function useMontado() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOk(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return ok;
}

function Produto({it}) {
  const [per, setPer] = useState({dias: 30, de: '', ate: ''});
  const todosDias = useMemo(() => Object.keys(it.porDia).sort(), [it]);
  const [ini, fim] =
    per.de || per.ate
      ? [per.de || '0000', per.ate || '9999']
      : !per.dias
        ? ['0000', '9999']
        : [diaLocal(new Date(Date.now() - (per.dias - 1) * 864e5)), '9999'];
  const p = useMemo(() => placar(it.serie, it.meta, ini, fim), [it, ini, fim]);
  const serieP = useMemo(() => Object.fromEntries(p.lojas.map(l => [l.loja, l.s])), [p]);
  const cor = Object.fromEntries(p.lojas.map((l, i) => [l.loja, corDaPosicao(i)]));
  const rotuloPer = per.de || per.ate ? 'no período' : per.dias ? `em ${per.dias} dias` : 'desde o início';
  const vazio = <p className="vazio">Sem preços neste período. Escolha um período maior.</p>;

  return (
    <section aria-live="polite">
      <div className="linha-grade">
        <Heroi it={it} />
        <Ranking it={it} lojas={p.lojas} cor={cor} rotuloPer={rotuloPer} />
      </div>
      <div className="linha-grade">
        <section className="cartao c-grafico entra" style={{animationDelay: '140ms'}}>
          <div className="cab">
            <div>
              <h2 className="tit cond">Preço por dia</h2>
              <p className="sub">
                Menor preço de cada loja em cada dia. Toque numa loja da legenda para mostrar a linha.
              </p>
            </div>
            <div className="chips" role="group" aria-label="Período">
              {PERIODOS.map(([dias, rotulo]) => {
                const on = !per.de && !per.ate && per.dias === dias;
                return (
                  <button
                    key={dias}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPer({dias, de: '', ate: ''})}
                    className={`chip${on ? ' on' : ''}`}
                  >
                    {rotulo}
                  </button>
                );
              })}
              {[
                ['de', 'De'],
                ['ate', 'até'],
              ].map(([k, rotulo]) => (
                <label key={k} className="flex items-center gap-1.5 text-sm text-tinta-2">
                  {rotulo}
                  <input
                    type="date"
                    value={per[k]}
                    min={todosDias[0]}
                    max={todosDias.at(-1)}
                    onChange={e => setPer({...per, [k]: e.target.value})}
                    className="data-per"
                  />
                </label>
              ))}
            </div>
          </div>
          <Grafico
            serie={serieP}
            meta={it.meta}
            minDias={2}
            soMaisBarata
            vazio="Sem preços neste período. Escolha um período maior."
          />
        </section>
        <section className="cartao c-rosca entra" style={{animationDelay: '210ms'}}>
          <div className="cab">
            <div>
              <h2 className="tit cond">Quem foi a mais barata</h2>
              <p className="sub">
                {p.dias.length
                  ? `Nos ${p.dias.length} ${p.dias.length === 1 ? 'dia' : 'dias'} com preço ${rotuloPer}, quantas vezes cada loja foi a mais barata`
                  : 'Sem dias com preço no período'}
              </p>
            </div>
          </div>
          {p.fatias.length ? <Rosca fatias={p.fatias} dias={p.dias.length} cor={cor} /> : vazio}
        </section>
      </div>
    </section>
  );
}

// cartão do melhor preço agora: foto, meta, etiqueta, a variação de 7 dias, o botão que abre o anúncio e a régua
function Heroi({it}) {
  const m = it.melhor;
  const foto = fotoDe(it.id);
  const d7 = m ? variacao7(it.porDia) : null;
  const var7 =
    d7 == null
      ? null
      : d7 > 0.5
        ? ['sobe', `↑ ${reais(d7)} em 7 dias`]
        : d7 < -0.5
          ? ['desce', `↓ ${reais(-d7)} em 7 dias`]
          : ['estavel', 'estável em 7 dias'];
  return (
    <section className="cartao c-heroi entra">
      <div className="heroi-topo">
        {foto && <img className="foto" src={foto} alt="" />}
        <div className="min-w-0">
          <p className="rotulo">Melhor preço agora</p>
          <h2 className="tit cond">{it.nome}</h2>
          {it.meta ? (
            <span className="meta-pill">
              <i aria-hidden="true" />
              Meta {reais(it.meta)}
            </span>
          ) : null}
        </div>
      </div>
      {m ? (
        <>
          <div className="preco-linha">
            <div className="etq">
              <span className="preco cond">{m.preco}</span>
              <span className="forma">{m.forma}</span>
            </div>
            {var7 && (
              <span className={`var7 ${var7[0]}`} title="Variação do menor preço do dia nos últimos 7 dias">
                {var7[1]}
              </span>
            )}
          </div>
          {m.dist && <p className={`dist ${m.dist.cls}`}>{m.dist.txt}</p>}
          <p className="onde">
            em <Logo loja={m.loja} className="h-6 max-w-[110px]" />
            {m.vendedor && <span>vendido por {m.vendedor}</span>}
            <span>· coletado em {m.visto}</span>
          </p>
          {m.cupom && (
            <p className="onde">
              com o cupom <Copiar codigo={m.cupom} mini />
            </p>
          )}
          {m.url && (
            <a className="btn-primario" href={m.url} target="_blank" rel="noopener noreferrer">
              Abrir o anúncio {naLoja(m.loja)}
              <SetaFora />
            </a>
          )}
          {it.parc && (
            <p className="parc-txt">
              Parcelado: {it.parc.total} {naLoja(it.parc.quem)}
            </p>
          )}
        </>
      ) : (
        <p className="vazio">
          Nenhuma loja com oferta ativa para este produto agora.
          {it.min && ` O menor preço já visto foi ${it.min.preco} ${naLoja(it.min.loja)}, em ${it.min.quando}.`}
        </p>
      )}
      <Regua meta={it.meta} min={it.min} agora={m?.valor} />
    </section>
  );
}

// régua: meta, menor já visto e o preço de agora na mesma linha (a faixa entre a meta e o preço fica vermelha acima
// da meta e verde abaixo)
function Regua({meta, min, agora}) {
  const montado = useMontado();
  const marcas = [];
  if (meta) marcas.push({rot: 'Meta', v: meta, c: 'm-meta'});
  if (agora != null && min && Math.abs(agora - min.valor) < 0.5)
    marcas.push({rot: 'Agora, o menor já visto', v: agora, c: 'm-agora'});
  else {
    if (min) marcas.push({rot: `Menor já visto (${min.quando.slice(0, 5)})`, v: min.valor, c: 'm-min'});
    if (agora != null) marcas.push({rot: 'Agora', v: agora, c: 'm-agora'});
  }
  if (marcas.length < 2) return null;
  const vs = marcas.map(x => x.v),
    lo = Math.min(...vs),
    hi = Math.max(...vs);
  const pos = v => (!montado ? 50 : hi - lo < 0.5 ? 50 : 8 + (84 * (v - lo)) / (hi - lo));
  marcas.sort((a, b) => a.v - b.v);
  const ref = agora ?? min?.valor;
  const faixa =
    meta && ref != null
      ? {
          cls: ref > meta ? 'acima' : 'abaixo',
          left: Math.min(pos(meta), pos(ref)),
          width: Math.abs(pos(ref) - pos(meta)),
        }
      : null;
  return (
    <div className="regua" role="img" aria-label={marcas.map(x => `${x.rot} ${reais(x.v)}`).join(', ')}>
      <div className="trilho" />
      {faixa && <div className={`faixa ${faixa.cls}`} style={{left: `${faixa.left}%`, width: `${faixa.width}%`}} />}
      {marcas.map((x, i) => {
        const ps = pos(x.v);
        const lado = ps < 24 ? 'esq' : ps > 76 ? 'dir' : 'meio';
        return (
          <div key={x.c} className={`marca ${x.c} ${i % 2 ? 'baixo' : 'cima'} ${lado}`} style={{left: `${ps}%`}}>
            <span className="pino" />
            <span className="mlabel" aria-hidden="true">
              {x.rot}
              <b>{reais(x.v)}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// onde comprar agora: as lojas com oferta ativa (a mais barata primeiro, cada uma com o link do anúncio) e, depois, as
// que tiveram preço no período mas estão sem oferta agora
function Ranking({it, lojas, cor, rotuloPer}) {
  const montado = useMontado();
  const minDe = Object.fromEntries(lojas.map(l => [l.loja, l.min]));
  const agora = it.agora || [];
  const linhas = [
    ...agora.map(a => ({...a, min: minDe[a.loja]})),
    ...lojas.filter(l => !agora.some(a => a.loja === l.loja)).map(l => ({loja: l.loja, preco: null, min: l.min})),
  ].slice(0, 8);
  const precos = agora.map(a => a.preco);
  const lo = precos.length ? Math.min(...precos) * 0.94 : 0,
    hi = precos.length ? Math.max(...precos) : 1,
    base = precos[0];
  return (
    <section className="cartao c-ranking entra" style={{animationDelay: '70ms'}}>
      <div className="cab">
        <div>
          <h2 className="tit cond">Onde comprar agora</h2>
          <p className="sub">
            {agora.length
              ? `${agora.length} ${agora.length === 1 ? 'loja com oferta' : 'lojas com oferta'} · cada linha leva ao anúncio`
              : 'sem oferta ativa'}
          </p>
        </div>
      </div>
      {!agora.length && (
        <p className="vazio mb-2.5 mt-0">
          Nenhuma loja com oferta ativa agora. Abaixo, as que tiveram preço {rotuloPer}.
        </p>
      )}
      <ol className="m-0 list-none p-0">
        {linhas.map((x, i) => {
          const tem = x.preco != null;
          const w = !tem ? 0 : agora.length === 1 ? 100 : 22 + (78 * (x.preco - lo)) / (hi - lo || 1);
          return (
            <li key={x.loja} className={`linha-loja${!tem ? ' sem' : i === 0 ? ' top' : ''}`}>
              <div className="ll-loja">
                <Logo loja={x.loja} className="h-6 max-w-[100px]" />
              </div>
              <div className="ll-barra" aria-hidden="true">
                <span style={{width: `${montado ? w : 0}%`, background: css(cor[x.loja] || '--ink-3')}} />
              </div>
              <div className="ll-preco">
                <b>{tem ? x.precoTxt : '—'}</b>
                {tem && i === 0 && <span className="selo">mais barata</span>}
                <small>
                  {tem && i > 0 ? `+ ${reais(x.preco - base)}` : ''}
                  {tem && i > 0 && x.min ? ' · ' : ''}
                  {x.min ? `mín. ${rotuloPer} ${reais(x.min)}` : ''}
                </small>
              </div>
              <div className="ll-link">
                {tem && x.url ? (
                  <LinkFora
                    url={x.url}
                    aria={`Ver o anúncio ${naLoja(x.loja)}${x.vendedor ? `, vendido por ${x.vendedor}` : ''} (abre em outra aba)`}
                  >
                    Ver anúncio
                  </LinkFora>
                ) : (
                  <span className="mudo-txt">{tem ? 'sem link' : 'sem oferta agora'}</span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
