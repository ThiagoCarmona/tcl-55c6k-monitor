// Abas "Cupons" e "Fontes" (26/11/2026, protótipo aprovado).
// Cupons: os cupons em cartões de "ticket" (valor, regra, compra mínima, validade e o código com copiar), filtrados por
// loja, com os cupons dos produtos monitorados à parte; e as postagens ligadas ao modelo > variante, com a comparação
// contra o melhor preço de agora. Fontes: o que está fora vem primeiro, em linguagem de gente; o resto em cartões.
import {useState} from 'react';
import {reais} from './logica.js';
import {Copiar, LinkFora, Logo, temLogo} from './componentes.jsx';

const atraso = i => ({animationDelay: `${Math.min(i, 9) * 35}ms`});
// mesmo dia no relógio de quem abre o painel
const ehHoje = iso => {
  const d = new Date(iso),
    h = new Date();
  return !isNaN(d) && d.toDateString() === h.toDateString();
};

export function Cupons({vm, modo, onModo}) {
  const [loja, setLoja] = useState('todas');
  const [grupo, setGrupo] = useState('todos');
  const ehPosts = modo === 'novos';
  const seus = vm.cupons.filter(c => c.especifico);
  const outros = vm.cupons.filter(c => !c.especifico);
  const nLoja = {};
  for (const c of outros) nLoja[c.loja] = (nLoja[c.loja] || 0) + 1;
  const lojas = Object.keys(nLoja).sort((a, b) => nLoja[b] - nLoja[a]);
  const lojaOk = loja === 'todas' || nLoja[loja] ? loja : 'todas';
  // melhor preço de agora de cada produto, para comparar com a postagem
  const melhor = Object.fromEntries(vm.vitrine.filter(v => v.melhor).map(v => [v.id, v.melhor.valor]));
  const grupos = [...new Map(vm.posts.filter(p => p.modelo).map(p => [p.modelo, p.modeloCurto])).entries()];
  const posts = vm.posts.filter(p => grupo === 'todos' || p.modelo === grupo);
  return (
    <>
      <section className="tab-cab entra">
        <div>
          <h2 className="tit cond">Cupons e postagens</h2>
          <p className="sub">
            {ehPosts
              ? 'Ofertas postadas no Telegram e no Promobit, ligadas ao modelo e à variante, as mais recentes primeiro.'
              : `${vm.cupons.length} cupons ativos de ${new Set(vm.cupons.map(c => c.loja)).size} lojas, com o código pronto para copiar.`}
          </p>
        </div>
        <div className="seg" role="group" aria-label="O que mostrar">
          <button
            type="button"
            className={ehPosts ? '' : 'on'}
            aria-pressed={!ehPosts}
            onClick={() => onModo('ativos')}
          >
            Cupons<span className="n">{vm.cupons.length}</span>
          </button>
          <button type="button" className={ehPosts ? 'on' : ''} aria-pressed={ehPosts} onClick={() => onModo('novos')}>
            Postagens<span className="n">{vm.posts.length}</span>
          </button>
        </div>
      </section>

      {!ehPosts && (
        <>
          {seus.length > 0 && lojaOk === 'todas' && (
            <section className="cartao seus entra">
              <div className="cab">
                <div>
                  <p className="rotulo">Para o que você monitora</p>
                  <h2 className="tit cond">Cupons dos seus produtos</h2>
                  <p className="sub">Valem só para anúncios específicos; o link abre o produto.</p>
                </div>
              </div>
              <div className="cup-grade">
                {seus.map((c, i) => (
                  <Cupom key={c.loja + c.codigo + i} c={c} />
                ))}
              </div>
            </section>
          )}
          {outros.length > 0 ? (
            <>
              <div
                className="lojas-filtro entra"
                style={{animationDelay: '70ms'}}
                role="group"
                aria-label="Filtrar por loja"
              >
                {['todas', ...lojas].map(l => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={lojaOk === l}
                    onClick={() => setLoja(l)}
                    className={`fl${lojaOk === l ? ' on' : ''}`}
                  >
                    {l === 'todas' ? <span>Todas</span> : <Logo loja={l} className="h-[20px] max-w-[84px]" />}
                    <span className="n">{l === 'todas' ? outros.length : nLoja[l]}</span>
                  </button>
                ))}
              </div>
              <div className="cup-grade">
                {outros
                  .filter(c => lojaOk === 'todas' || c.loja === lojaOk)
                  .map((c, i) => (
                    <Cupom key={lojaOk + c.loja + c.codigo + i} c={c} i={i} />
                  ))}
              </div>
            </>
          ) : (
            !seus.length && <p className="vazio">Nenhum cupom aplicável no momento.</p>
          )}
        </>
      )}

      {ehPosts &&
        (vm.posts.length ? (
          <>
            {grupos.length > 1 && (
              <div className="chips entra" style={{marginBottom: 14}} role="group" aria-label="Filtrar por modelo">
                {[['todos', 'Todos'], ...grupos].map(([id, rot]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={grupo === id}
                    onClick={() => setGrupo(id)}
                    className={`chip${grupo === id ? ' on' : ''}`}
                  >
                    {rot}
                  </button>
                ))}
              </div>
            )}
            <section className="cartao entra" style={{animationDelay: '70ms'}}>
              <ul>
                {posts.map(p => (
                  <Post key={p.chave} p={p} melhor={melhor[p.produto]} />
                ))}
              </ul>
            </section>
          </>
        ) : (
          <p className="vazio">Nenhuma postagem registrada.</p>
        ))}
    </>
  );
}

// cupom em "ticket": o valor grande, a regra, a compra mínima, a validade (vermelha se vence hoje) e o código
function Cupom({c, i = 0}) {
  const hoje = c.vence && ehHoje(c.vence);
  const titulo = c.regra && !/R\$\s?\d|%/.test(c.titulo) ? c.regra : c.titulo;
  return (
    <article className="cupom entra" style={atraso(i)}>
      <div className="cp-topo">
        <Logo loja={c.loja} className="h-[24px] max-w-[110px]" />
        <span className={`val${hoje ? ' urg' : ''}`}>
          {!c.validade
            ? 'sem validade informada'
            : hoje
              ? `vence hoje, ${c.validade.slice(-5)}`
              : `vale até ${c.validade.slice(0, 5)}`}
        </span>
      </div>
      <p className={`cp-valor cond${c.valor ? '' : ' sem'}`}>{c.valor || 'Ver a regra'}</p>
      <p className="cp-tit">{titulo}</p>
      {c.minimo && <p className="cp-min">Compras acima de {c.minimo}</p>}
      <div className="cp-rodape">
        <Copiar codigo={c.codigo} />
        {c.url && (
          <a className="cp-lnk" href={c.url} target="_blank" rel="noopener noreferrer">
            {c.especifico ? 'Ver o produto' : 'Ver cupom'}
          </a>
        )}
      </div>
    </article>
  );
}

// postagem: modelo > variante, o título, a loja, o cupom, de onde veio e o preço contra o melhor de agora
function Post({p, melhor}) {
  const d = !p.expirada && p.valor && melhor ? melhor - p.valor : 0;
  const via = p.telegram ? `Telegram, ${p.canal || 'canal público'}` : 'Promobit';
  return (
    <li className={`post${p.expirada ? ' exp' : ''}`}>
      <div className="mv">
        <span className="md">{p.modeloCurto || p.chip.texto}</span>
        <span className="vr">{p.variante || p.chip.texto}</span>
      </div>
      <div className="min-w-0">
        <p className="ps-tit" title={p.texto || p.titulo}>
          {p.texto || p.titulo}
        </p>
        <div className="ps-meta">
          <Logo loja={p.loja} className="h-[18px] max-w-[76px]" />
          {p.cupom && <Copiar codigo={p.cupom} mini />}
          <span>
            {via} · {p.quando}
          </span>
          {p.expirada && <span className="chipz bad">encerrada</span>}
        </div>
      </div>
      <div className="ps-preco">
        <b>{p.preco === '—' ? 'preço na postagem' : p.preco}</b>
        {Math.abs(d) >= 1 && (
          <small className={d > 0 ? 'abaixo' : 'acima'}>
            {reais(Math.abs(d))} {d > 0 ? 'abaixo' : 'acima'} do melhor de agora
          </small>
        )}
      </div>
      <div className="ps-link">
        <LinkFora url={p.url} aria={`Abrir a postagem no ${p.telegram ? 'Telegram' : 'Promobit'} (abre em outra aba)`}>
          Abrir postagem
        </LinkFora>
      </div>
    </li>
  );
}

// nome de gente para cada fonte da coleta, o grupo e a loja do logo (sem logo: a inicial)
const NOMES_FONTES = {
  americanas: ['Americanas', 'lojas', 'Americanas'],
  carrefour: ['Carrefour', 'lojas', 'Carrefour'],
  hype: ['Hype (gift card PSN)', 'lojas', 'Hype'],
  'kabum.produtos': ['KaBuM!', 'lojas', 'KaBuM!'],
  'magalu.produtos': ['Magazine Luiza', 'lojas', 'Magazine Luiza'],
  maiscorreios: ['Mais Correios', 'lojas', 'Mais Correios'],
  'mercadolivre.playstation': ['Mercado Livre (loja oficial PlayStation)', 'lojas', 'Mercado Livre'],
  psstore: ['PlayStation Store', 'lojas', 'PlayStation Store'],
  'vtex.fastshop.ps5': ['Fast Shop', 'lojas', 'Fast Shop'],
  'vtex.webcontinental.ps5': ['Webcontinental', 'lojas', 'Webcontinental'],
  'promobit.busca': ['Promobit: busca de ofertas', 'ag', 'Promobit'],
  'promobit.cupons': ['Promobit: cupons', 'ag', 'Promobit'],
  'promobit.ps5': ['Promobit: página do PS5', 'ag', 'Promobit'],
  'telegram.publico': ['Telegram: canais públicos', 'ag', 'Telegram'],
};
// erro sem o horário do início e sem o endereço do fim ("2026-11-26T07:15:15-03:00 RuntimeError: ... for url: ...")
const erroCurto = e =>
  String(e || '')
    .replace(/^\d{4}-\d\d-\d\dT\S+\s+/, '')
    .replace(/ for url:.*$/, '');
// fonte nova, fora da lista: agregador se o nome diz, senão loja
const nomeFonte = n => NOMES_FONTES[n] || [n, /^(promobit|telegram|pelando)/.test(n) ? 'ag' : 'lojas', n];
const GRUPOS_FONTES = [
  ['lojas', 'Lojas'],
  ['ag', 'Agregadores de ofertas'],
];

export function Fontes({vm}) {
  const fo = vm.fontes;
  const ok = fo.filter(f => f.classe === 'ok').length;
  const ruins = fo.filter(f => f.classe === 'bad');
  const ordem = {bad: 0, warn: 1, ok: 2};
  return (
    <>
      <section className="tab-cab entra">
        <div>
          <h2 className="tit cond">
            {!fo.length
              ? 'Fontes'
              : ok === fo.length
                ? `Todas as ${fo.length} fontes funcionando`
                : `${ok} de ${fo.length} fontes funcionando`}
          </h2>
          <p className="sub">A coleta roda na nuvem a cada 15 minutos. Última: {vm.quando}.</p>
        </div>
      </section>
      {!fo.length && <p className="vazio">Sem o estado das fontes nesta coleta.</p>}
      {ruins.map(r => (
        <section key={r.nome} className="cartao alerta entra" style={{animationDelay: '60ms'}}>
          <svg
            className="ic"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3l9.5 17h-19z" />
            <path d="M12 10v4M12 17.5h.01" />
          </svg>
          <div>
            <h3>
              {nomeFonte(r.nome)[0]} está fora{r.ultimoOk !== '—' ? ` desde ${r.ultimoOk.slice(0, 5)}` : ''}
            </h3>
            <p>
              {/403/.test(r.erro) ? 'O site recusa o robô (erro 403) em toda coleta' : 'A coleta falha em toda rodada'},{' '}
              {r.falhas} vezes seguidas. Os preços dessa fonte não entram no painel.
            </p>
            {r.erro && <p className="tec">{erroCurto(r.erro)}</p>}
          </div>
        </section>
      ))}
      {GRUPOS_FONTES.map(([g, nome], gi) => {
        const itens = fo.filter(f => nomeFonte(f.nome)[1] === g).sort((a, b) => ordem[a.classe] - ordem[b.classe]);
        if (!itens.length) return null;
        return (
          <section key={g} className="fontes-grupo entra" style={{animationDelay: `${120 + gi * 70}ms`}}>
            <h3>{nome}</h3>
            <div className="fontes-grade">
              {itens.map(f => {
                const [rot, , logo] = nomeFonte(f.nome);
                return (
                  <div
                    key={f.nome}
                    className={`fonte${f.classe === 'bad' ? ' ruim' : f.classe === 'warn' ? ' atencao' : ''}`}
                  >
                    {temLogo(logo) ? (
                      <Logo loja={logo} className="h-[24px] max-w-[64px]" />
                    ) : (
                      <span className="ini" aria-hidden="true">
                        {rot.slice(0, 1)}
                      </span>
                    )}
                    <span className="fn">
                      <b>{rot}</b>
                      <small className="tec">{f.nome}</small>
                    </span>
                    <span className="estado">
                      <i aria-hidden="true" />
                      {f.rotulo}
                    </span>
                    <span className="ult">
                      Último OK: {f.ultimoOk}
                      {f.classe !== 'ok' && f.erro ? ` · ${erroCurto(f.erro).slice(0, 80)}` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
