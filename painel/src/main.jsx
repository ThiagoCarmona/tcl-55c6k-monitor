import {StrictMode, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {agrupaPorModelo, montaPainel} from './logica.js';
import {Fato, H2} from './componentes.jsx';
import Vitrine, {Pilulas} from './Vitrine.jsx';
import Tabelas from './Tabelas.jsx';
import {Cupons, Fontes} from './Abas.jsx';
import './estilo.css';

const pega = (u, como) =>
  fetch(u + '?t=' + Date.now())
    .then(r => (r.ok ? r[como]() : null))
    .catch(() => null);

// estado salvo nesta sessão do navegador (a aba escolhida); sem storage (aba anônima), só na memória
function useSessao(chave, inicial) {
  const [v, setV] = useState(() => {
    try {
      return sessionStorage.getItem(chave) ?? inicial;
    } catch {
      return inicial;
    }
  });
  return [
    v,
    novo => {
      setV(novo);
      try {
        sessionStorage.setItem(chave, novo);
      } catch {
        /* sem storage */
      }
    },
  ];
}

function App() {
  const [vm, setVm] = useState(undefined); // undefined: carregando; null: sem dados
  const [abaSalva, setAba] = useSessao('aba', 'produtos');
  const [filtroCupons, setFiltroCupons] = useSessao('cupons', 'ativos'); // aba Cupons: 'ativos' (cupons) ou 'novos' (postagens)
  const aba = ABAS.some(([k]) => k === abaSalva) ? abaSalva : 'produtos';
  // dados publicados em data/, buscados na abertura (o botão de atualizar recarrega a página)
  useEffect(() => {
    Promise.all([
      pega('data/latest_cloud.json', 'json'),
      pega('data/latest_pc.json', 'json'),
      pega('data/historico_cloud.csv', 'text'),
      pega('data/historico_pc.csv', 'text'),
    ]).then(([cloud, pc, csvCloud, csvPc]) => setVm(montaPainel({cloud, pc, csvCloud, csvPc})));
  }, []);
  const rolaETroca = nome => {
    setAba(nome);
    scrollTo(0, 0);
  };

  // variante escolhida (#p= no endereço); sem escolha válida, fica a primeira com preço. As pílulas do topo são os
  // modelos (PS5, GTA 6...); tocar num modelo abre a variante mais barata dele
  const [prodId, setProdId] = useState(() => decodeURIComponent((location.hash.match(/^#p=(.+)$/) || [])[1] || ''));
  const itens = vm ? vm.vitrine : [];
  const modelos = agrupaPorModelo(itens, v => !!v.melhor);
  const atual = itens.find(it => it.id === prodId) || itens.find(it => it.melhor) || itens[0];
  const modeloAtual = modelos.find(m => m.id === atual?.modelo);
  const escolhe = id => {
    setProdId(id);
    try {
      history.replaceState(null, '', '#p=' + encodeURIComponent(id));
    } catch {
      /* sandbox */
    }
  };
  const escolheModelo = m => {
    if (m.id === atual?.modelo) return;
    const com = m.itens.filter(v => v.melhor);
    escolhe((com.length ? com.reduce((a, b) => (b.melhor.valor < a.melhor.valor ? b : a)) : m.itens[0]).id);
  };
  return (
    <>
      <header className="bg-band text-band-ink">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-end justify-between gap-x-6 gap-y-2.5 px-4 pb-3.5 pt-[18px] sm:px-6 sm:pt-[22px]">
          <h1 className="m-0 font-cond text-[clamp(40px,7vw,64px)] font-bold leading-[.95] tracking-[-.01em]">
            Monitor de Preços
          </h1>
          <div className="flex flex-wrap items-center gap-1">
            <p className="m-0 mr-1 text-base text-band-ink-2">
              Última coleta:{' '}
              <b className="text-band-ink">{vm === undefined ? '—' : vm ? vm.quando : 'ainda sem dados'}</b>
            </p>
            <BotaoNovoProduto />
            <BotaoAtualizar />
            <BotaoTema />
          </div>
        </div>
        {aba === 'produtos' && itens.length > 0 && <Pilulas modelos={modelos} atual={atual} onModelo={escolheModelo} />}
      </header>

      <main className="mx-auto max-w-[1180px] px-4 pb-[104px] pt-4 sm:px-6 sm:pb-[96px] sm:pt-6">
        {vm === undefined ? (
          <p className="py-3 text-base text-tinta-3">Carregando os preços…</p>
        ) : !vm ? (
          <p className="py-3 text-base text-tinta-3">Ainda sem dados em data/.</p>
        ) : (
          <>
            {aba === 'produtos' && (
              <>
                <Vitrine it={atual} modelo={modeloAtual} onVariante={escolhe} />
                <H2>Resumo</H2>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <Fato k="Cupons ativos" d={vm.resumo.cupons} />
                  <Fato k="Postagens (7 dias)" d={vm.resumo.posts} />
                  <Fato k="Melhor gift card PSN" d={vm.resumo.gift} />
                </div>
              </>
            )}
            {aba === 'tabelas' && <Tabelas vm={vm} />}
            {aba === 'cupons' && <Cupons vm={vm} modo={filtroCupons} onModo={setFiltroCupons} />}
            {aba === 'fontes' && <Fontes vm={vm} />}
          </>
        )}
        <footer className="mt-11 border-t-2 border-linha pt-3 text-sm text-tinta-3">
          Preços sem garantia; confira na loja antes de comprar. Dados em <code>data/</code> neste repositório.
        </footer>
      </main>

      <Barra aba={aba} onAba={rolaETroca} />
    </>
  );
}

function BotaoTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
  // sem escolha salva, acompanha o sistema
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const segue = e => {
      let t = null;
      try {
        t = localStorage.getItem('tema');
      } catch {
        /* sem storage */
      }
      if (!t) aplica(e.matches);
    };
    mq.addEventListener?.('change', segue);
    return () => mq.removeEventListener?.('change', segue);
  }, []);
  const aplica = e => {
    document.documentElement.classList.toggle('dark', e);
    setEscuro(e);
  };
  const troca = () => {
    aplica(!escuro);
    try {
      localStorage.setItem('tema', escuro ? 'light' : 'dark');
    } catch {
      /* sem storage */
    }
  };
  return (
    <button
      type="button"
      aria-pressed={escuro}
      aria-label="Tema escuro"
      title={escuro ? 'Tema claro' : 'Tema escuro'}
      onClick={troca}
      className={BOTAO_ICONE}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {escuro ? (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
// só o ícone, sem contorno (o foco do teclado continua visível pelo contorno amarelo global)
const BOTAO_ICONE =
  'inline-flex items-center justify-center rounded-full p-1.5 text-band-ink transition-opacity duration-150 hover:opacity-80 disabled:cursor-wait';

// novo produto (14/11/2026): a página é estática e pública, então não muda o robô sozinha. A janela monta o pedido e
// abre uma issue já preenchida no GitHub (a pessoa confirma lá, logada); o workflow novo-produto.yml põe o produto no
// catálogo (monitor/produtos_extras.json) e dispara uma coleta. Nenhum token na página. O formato do corpo
// ("**Rótulo:** valor") é lido por monitor/novo_produto.py.
const URL_NOVA_ISSUE = 'https://github.com/luisdfcalazans-dot/tcl-55c6k-monitor/issues/new';
const CAMPOS_PEDIDO = [
  ['produto', 'Produto', 'ex.: SSD NVMe M.2 1TB', true],
  ['tem', 'O que o título precisa ter (separe por vírgula)', 'ex.: ssd, nvme, 1tb', false],
  ['fora', 'O que não serve (separe por vírgula)', 'ex.: sata, externo, 2tb', false],
  ['pix', 'Meta à vista / Pix (R$)', 'ex.: 700', true],
  ['parcelado', 'Meta parcelada (R$, opcional)', 'ex.: 750', false],
];
function BotaoNovoProduto() {
  const janela = useRef(null);
  const [v, setV] = useState({});
  const envia = e => {
    e.preventDefault();
    const corpo = CAMPOS_PEDIDO.filter(([k]) => v[k]?.trim())
      .map(([k, rotulo]) => `**${rotulo}:** ${v[k].trim()}`)
      .join('\n\n');
    const url = `${URL_NOVA_ISSUE}?title=${encodeURIComponent('Novo produto: ' + v.produto.trim())}&body=${encodeURIComponent(
      corpo + '\n\n_Pedido feito pelo botão ➕ do painel._',
    )}`;
    window.open(url, '_blank', 'noopener');
    janela.current.close();
    setV({});
  };
  return (
    <>
      <button
        type="button"
        aria-label="Pedir um produto novo"
        title="Pedir um produto novo"
        onClick={() => janela.current.showModal()}
        className={BOTAO_ICONE.replace('text-band-ink', 'text-[#45CF91]')}
      >
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <dialog
        ref={janela}
        aria-labelledby="novo-produto-titulo"
        className="w-[min(420px,calc(100vw-32px))] rounded-[4px] border-2 border-linha bg-superficie p-5 text-tinta backdrop:bg-black/50"
      >
        <form onSubmit={envia}>
          <p id="novo-produto-titulo" className="m-0 text-xl font-bold">
            Pedir um produto novo
          </p>
          <p className="mt-1 text-sm text-tinta-3">
            O pedido abre uma issue no GitHub já preenchida: confirme lá, logado. Em poucos minutos o produto entra no
            robô e uma coleta nova começa. Sem termos, vale o nome do produto.
          </p>
          {CAMPOS_PEDIDO.map(([k, rotulo, dica, obrigatorio]) => (
            <label key={k} className="mt-3 block text-sm text-tinta-2">
              {rotulo}
              {obrigatorio && <span className="text-bad"> *</span>}
              <input
                type={k === 'pix' || k === 'parcelado' ? 'number' : 'text'}
                min={k === 'pix' || k === 'parcelado' ? 1 : undefined}
                step="any"
                required={obrigatorio}
                placeholder={dica}
                value={v[k] || ''}
                onChange={e => setV({...v, [k]: e.target.value})}
                className="mt-1 block w-full rounded-[3px] border-2 border-linha bg-superficie px-2 py-1 text-base text-tinta"
              />
            </label>
          ))}
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="submit"
              className="min-w-[120px] rounded-[3px] bg-[#1F4FA3] px-4 py-2 font-bold text-white transition-opacity duration-150 hover:opacity-90"
            >
              Enviar pedido
            </button>
            <button
              type="button"
              onClick={() => janela.current.close()}
              className="min-w-[120px] rounded-[3px] bg-[#D7263D] px-4 py-2 font-bold text-white transition-opacity duration-150 hover:opacity-90"
            >
              Cancelar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

// atualizar: o mesmo que o F5 (recarrega a página e, com ela, os dados publicados em data/)
const BotaoAtualizar = () => (
  <button
    type="button"
    aria-label="Atualizar"
    title="Atualizar"
    onClick={() => location.reload()}
    className={BOTAO_ICONE}
  >
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18.5 2v3.8h-3.8M5.5 22v-3.8h3.8" />
    </svg>
  </button>
);

// barra inferior (30/10/2026): as abas (uma parte do painel por vez); a escolha do produto fica nas pílulas do topo
const ABAS = [
  [
    'produtos',
    'Produtos',
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </>,
  ],
  [
    'tabelas',
    'Tabelas',
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9.5h18M3 14.5h18M9 9.5V20" />
    </>,
  ],
  [
    'cupons',
    'Cupons',
    <>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" />
      <path d="M14.5 9l-5 6M9.5 9.5h.01M14.5 14.5h.01" />
    </>,
  ],
  ['fontes', 'Fontes', <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />],
];
function Barra({aba, onAba}) {
  return (
    <nav
      aria-label="Navegação do painel"
      className="fixed inset-x-0 bottom-0 z-20 border-t-[3px] border-etiqueta bg-band pb-[env(safe-area-inset-bottom)] text-band-ink"
    >
      <div className="mx-auto max-w-[1180px] px-3 py-1.5 sm:px-6 sm:py-2">
        <div className="flex justify-between gap-1 sm:justify-end">
          {ABAS.map(([k, rotulo, icone]) => (
            <button
              key={k}
              type="button"
              aria-current={aba === k ? 'page' : undefined}
              onClick={() => onAba(k)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-[3px] px-0.5 py-1 text-xs font-bold transition-colors duration-150 sm:flex-none sm:flex-row sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm
              ${aba === k ? 'bg-etiqueta text-etiqueta-ink' : 'text-band-ink-2 hover:text-band-ink'}`}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {icone}
              </svg>
              {rotulo}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
