"""TVs fora do monitor e do painel e gift card da PSN (pedido do usuário em 26/10/2026).

O usuário vai ficar com a TV ("não preciso mais monitorar") e quer só o PS5 e o GTA 6; e cogita comprar o GTA 6 digital
na PS Store pagando com gift card comprado com desconto (a pesquisa de 26/10 confirmou: a PS Store BR aceita o saldo da
carteira na pré-venda, cobrada na hora; o saldo é usado primeiro e o resto vai para o cartão de crédito).

Cobre, com config.TVS_DESLIGADAS ligada: as fontes só de TV fora do registro, as buscas das fontes mistas sem os termos e
EANs das TVs, a rede do run.py (oferta/postagem/cupom de TV saem logo depois da coleta), o latest sem nada de TV (com o
sinal "tvs_desligadas"), o resumo sem falar de TV, o testador sem TV mesmo com --forcar e o painel sem a parte das TVs.
E o gift card: as fontes de loja (Hype, KaBuM), as lojas oficiais (1P em KaBuM/Americanas/Amazon/Magalu), o valor de
face, a meta da pesquisa (15%, cartão de R$ 100 ou mais, sem alerta abaixo de 10%), o alerta, o resumo, o latest e o
painel. Nada vai à rede.

26/11/2026: o gift card virou um produto comum (seção do PS5). Saíram as contas do GTA 6 digital pago com gift card
(combinação de valores de face, custo efetivo na PS Store, Standard × Ultimate) e a meta de 10% perto do prazo.
"""

from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest

from monitor import config, produtos
from monitor.estado import Estado
from monitor.models import Cupom, Oferta, modelo_de
from monitor.regras import gerar_alertas, resumo_diario, sanear
from monitor.util import agora_iso

RAIZ = Path(__file__).resolve().parent.parent
TV_TERMOS = {"55c6k", "65c6k", "tcl 55c6k", "tcl 65c6k", "tcl c6k 55", "tcl c6k 65"}


@pytest.fixture(autouse=True)
def dados(tmp_path, monkeypatch):
    """docs/data num diretório temporário (nada lê nem grava o repositório)."""
    monkeypatch.setattr(config, "DIR_DADOS", tmp_path)
    for k, v in (("ALVO_PIX", 2900.0), ("ALVO_PARCELADO", 3000.0), ("ALVO_PIX_65", 3300.0),
                 ("ALVO_PARCELADO_65", 3500.0)):
        monkeypatch.setattr(config, k, v)
    return tmp_path


@pytest.fixture
def sem_tvs(monkeypatch):
    monkeypatch.setattr(config, "TVS_DESLIGADAS", True)


def _state(pasta, **extra):
    d = {"ofertas": {}, "cupons": {}, "minimo": None, "saude": {}, "ultimo_resumo": None,
         "criado_em": "2026-09-13T15:22:00-03:00", "modelos_iniciados": list(produtos.IDS)}
    d.update(extra)
    (pasta / "state_cloud.json").write_text(json.dumps(d), encoding="utf-8")


def _gift(loja, face, preco, oid, tipo="loja", vendedor=None, **kw):
    fonte = {"Hype": "hype", "KaBuM!": "kabum.produtos"}.get(loja, "promobit") if tipo == "loja" else "promobit"
    return Oferta(fonte, tipo, loja, f"R${face:.0f} Gift Card PlayStation Store [Exclusivo Brasil]", f"https://g/{oid}",
                  oid, preco=preco, vendedor=vendedor if vendedor is not None else (loja if tipo == "loja" else None),
                  publicado=agora_iso() if tipo == "post" else None, modelo="GIFT_CARD_PSN",
                  extra={"produto": {"valor_face": float(face)}}, **kw)


# =====================================================================================================================
# A) TVs desligadas
# =====================================================================================================================

def test_fontes_so_de_tv_nao_rodam_com_a_chave_ligada(sem_tvs):
    from monitor import sources

    nomes = {f.nome for f in sources.todas()}
    assert not nomes & set(sources.FONTES_SO_TV)
    assert {"promobit.busca", "promobit.ps5", "kabum.produtos", "magalu.produtos", "maiscorreios", "americanas",
            "psstore", "mercadolivre.playstation", "hype", "telegram.publico", "pelando.busca", "amazon.produtos",
            "casasbahia.produtos", "mercadolivre.produtos"} <= nomes


def test_religar_as_tvs_volta_as_fontes_de_antes(monkeypatch):
    from monitor import sources

    monkeypatch.setattr(config, "TVS_DESLIGADAS", False)
    assert set(sources.FONTES_SO_TV) <= {f.nome for f in sources.todas()}


def test_buscas_das_fontes_mistas_sem_os_termos_das_tvs(sem_tvs, monkeypatch):
    from monitor.sources import pelando, promobit, telegram_public

    assert produtos.familias_monitoradas() == (produtos.FAMILIA_PS5, produtos.FAMILIA_GTA6, produtos.FAMILIA_ACESSORIO,
                                               produtos.FAMILIA_SSD, produtos.FAMILIA_EXTRA)
    pedidos = []
    monkeypatch.setattr(promobit, "get_json", lambda url, **k: pedidos.append(url) or {})
    promobit.PromobitBusca().coletar()
    monkeypatch.setattr(pelando, "get_html", lambda url, **k: pedidos.append(url) or "")
    pelando.PelandoBusca().coletar()
    urls = " ".join(pedidos).lower().replace("%20", " ")
    assert pedidos and not any(t.replace(" ", "") in urls.replace(" ", "") for t in ("55c6k", "65c6k", "c6k"))
    assert "gift card playstation" in urls
    assert "ssd nvme 1tb" in urls   # o SSD do notebook (14/11) também é buscado com as TVs desligadas
    termos = " ".join(u for _c, u in telegram_public.urls_de_busca(["pelandobr"])).lower()
    assert "55c6k" not in termos and "65c6k" not in termos and "gta" in termos


def test_buscas_com_as_tvs_ligadas_continuam_com_os_termos_delas():
    assert produtos.familias_monitoradas() is None
    assert TV_TERMOS & {t.lower() for t in produtos.termos("promobit", produtos.familias_monitoradas())}


def test_mais_correios_e_americanas_sem_os_eans_das_tvs(sem_tvs, monkeypatch):
    from monitor.sources import vtex

    pedidas = []
    monkeypatch.setattr(vtex, "get_json", lambda url, **k: pedidas.append(url) or [])
    vtex.VtexEan("maiscorreios").coletar()
    eans_tv = [e.lstrip("0") for p in produtos.TVS for e in produtos.PRODUTOS[p].eans]
    assert pedidas and not any(e in pedidas[0] for e in eans_tv)
    assert "711719021490" in pedidas[0]   # o PS5 Digital continua


def _roda_main(monkeypatch, capsys, ofertas, cupons=(), argv_extra=()):
    import run
    from monitor import sources

    class Fake(sources.Fonte):
        nome = "fake"

        def coletar(self):
            return list(ofertas), list(cupons)

    monkeypatch.setattr(sources, "por_modo", lambda modo: [Fake()])
    monkeypatch.setattr(run, "carrega_env", lambda: None)
    monkeypatch.setattr(sys, "argv", ["run.py", "--mode", "cloud", "--no-notify", *argv_extra])
    monkeypatch.setattr(config, "HORA_RESUMO_DIARIO", -1)
    monkeypatch.setattr(config, "ALVO_PIX_65", config.ALVO_PIX_65)
    monkeypatch.setattr(config, "ALVO_PARCELADO_65", config.ALVO_PARCELADO_65)
    assert run.main() == 0
    return capsys.readouterr().out


def test_run_tira_tv_logo_depois_da_coleta_e_o_latest_sai_sem_tv(dados, sem_tvs, monkeypatch, capsys):
    agora = agora_iso()
    tv_antiga = {"fonte": "telegram.publico", "tipo": "post", "loja": "Amazon", "titulo": "Smart TV TCL 65C6K",
                 "url": "https://t/velha", "id": "velha", "preco": 3000.0, "ativo": True, "modelo": "65C6K",
                 "publicado": agora, "primeira_vez": agora, "chave": "telegram.publico:velha"}
    _state(dados, ofertas={"telegram.publico:velha": tv_antiga}, minimo={"preco": 3000.0, "loja": "Amazon"})
    ofertas = [
        Oferta("maiscorreios", "loja", "Mais Correios", "Smart TV TCL 55C6K", "https://mc/tv", "tv1", preco=2700.0,
               vendedor="Mais Correios", modelo="55C6K"),
        Oferta("promobit", "post", "Amazon", "Smart TV TCL 65C6K por R$ 3.000", "https://p/tv", "tv2", preco=3000.0,
               publicado=agora, modelo="65C6K"),
        Oferta("promobit", "post", "Netshoes", "PS5 Slim Digital", "https://p/ps5", "ps5", preco=3499.0,
               publicado=agora, modelo="PS5_DIGITAL"),
    ]
    cupons = [Cupom("magalu", "Magazine Luiza", "TV100", "R$ 100 OFF na TV", "https://m/c", "c1", especifico=True,
                    modelo="55C6K"),
              Cupom("magalu", "Magazine Luiza", "PS5200", "R$ 200 OFF no PS5", "https://m/c2", "c2", especifico=True,
                    modelo="PS5_DIGITAL")]
    out = _roda_main(monkeypatch, capsys, ofertas, cupons)
    cabs = [b.split("\n")[0] for b in out.split("[alerta]\n")[1:]]
    assert cabs and not any("TCL" in c for c in cabs) and any("PS5 Slim Digital" in c for c in cabs)
    assert "[tvs]" in out and "55C6K 0.00" not in out
    latest = json.loads((dados / "latest_cloud.json").read_text(encoding="utf-8"))
    assert latest["tvs_desligadas"] is True
    assert not any(produtos.eh_tv(modelo_de(o)) for o in latest["ofertas_loja"] + latest["posts"])
    assert not any(c.get("modelo") and produtos.eh_tv(c["modelo"]) for c in latest["cupons"])
    assert {"alvo_pix", "alvo_parcelado", "alvos", "minimo", "minimo_65C6K"}.isdisjoint(latest)
    assert not set(latest["produtos"]) & set(produtos.TVS)
    assert "gift_card_psn" in latest
    state = json.loads((dados / "state_cloud.json").read_text(encoding="utf-8"))
    # a TV desta rodada não entrou no state; a antiga continua lá (para religar), só não vai ao latest
    assert "maiscorreios:tv1" not in state["ofertas"] and "promobit:tv2" not in state["ofertas"]
    assert "telegram.publico:velha" in state["ofertas"]


def test_run_com_as_tvs_ligadas_publica_as_tvs_como_antes(dados, monkeypatch, capsys):
    _state(dados)
    ofertas = [Oferta("maiscorreios", "loja", "Mais Correios", "Smart TV TCL 55C6K", "https://mc/tv", "tv1",
                      preco=2700.0, vendedor="Mais Correios", modelo="55C6K")]
    _roda_main(monkeypatch, capsys, ofertas)
    latest = json.loads((dados / "latest_cloud.json").read_text(encoding="utf-8"))
    assert latest["tvs_desligadas"] is False and "alvos" in latest and "minimo" in latest
    assert any(o["modelo"] == "55C6K" for o in latest["ofertas_loja"])


def test_resumo_diario_sem_falar_de_tv(dados, sem_tvs):
    _state(dados)
    est = Estado("cloud")
    ps = Oferta("kabum.produtos", "loja", "KaBuM!", "PS5 Slim Digital", "https://k/1", "1", preco=3499.0,
                vendedor="KaBuM!", modelo="PS5_DIGITAL")
    txt = resumo_diario(est, [ps], [], vigia=True)
    assert txt.startswith("☀️ <b>Resumo diário — PS5, GTA 6 e SSD</b>") and "TV" not in txt


def test_testador_sem_tvs_mesmo_com_forcar_e_codigos(sem_tvs, monkeypatch):
    import testar_cupons as tc

    chamadas = []
    monkeypatch.setattr(tc, "executar", lambda *a: chamadas.append(a) or 0)
    for extra in ([], ["--forcar"], ["--codigos", "ABC10"]):
        monkeypatch.setattr(sys, "argv", ["testar_cupons.py", "--no-notify", *extra])
        tc.main()
        assert tuple(chamadas[-1][-1]) == tuple(produtos.TVS), extra


def test_workflow_e_docs_falam_de_ps5_e_gta():
    yml = (RAIZ / ".github" / "workflows" / "monitor.yml").read_text(encoding="utf-8")
    assert yml.splitlines()[0].startswith("name: monitor PS5 e GTA 6")
    assert "TVS_DESLIGADAS: ${{ vars.TVS_DESLIGADAS }}" in yml


# =====================================================================================================================
# B) gift card da PSN
# =====================================================================================================================

def test_valor_de_face_ignora_o_preco_a_parcela_e_o_minimo():
    vf = produtos.valor_face
    assert vf("Por R$ 85 o gift card PlayStation de R$ 100") == 100.0   # o 1º valor era o preço
    assert vf("Gift card PSN R$ 300 por R$ 250 em 10x R$ 25 sem juros") == 300.0
    assert vf("Gift Card PSN R$ 450 em 4x R$ 112 sem juros") == 450.0
    assert vf("6% OFF em gift card PlayStation (mínimo R$ 450)") is None
    assert vf("Gift card PSN: 2x R$ 100 por R$ 150") == 200.0           # ML, 07/09/2026
    assert vf("Gift Card PlayStation R$300 Vale-Presente") == 300.0
    assert vf("Gift Card PSN R$ 100 sai a R$ 85") == 100.0


# ---- revisão de 26/10: limite, cashback e lista de valores não são o valor de face -------------------------------

def _post_gift(titulo, preco, loja="Hype", oid="r"):
    o = Oferta("promobit", "post", loja, titulo, f"https://p/{oid}", oid, preco=preco, modelo="GIFT_CARD_PSN",
               publicado=agora_iso())
    o.extra["produto"] = dict(produtos._classifica_titulo(titulo, "").detalhes)
    return o


@pytest.mark.parametrize("titulo,face", [
    ("Gift Card PlayStation Store R$ 150 por R$ 135 - limite de R$ 300 por CPF", 150.0),
    ("Gift Card PlayStation Store R$ 250 por R$ 225 — ganhe R$ 450 em cashback", 250.0),
    ("Gift Card PSN R$ 60, R$ 100 e R$ 300 com 10% OFF na Hype", None),       # de qual é o preço?
    ("Gift Card PSN R$ 300 com desconto (até R$ 500 por CPF)", 300.0),
    ("Gift Card PSN com desconto (até R$ 500 por CPF)", None),
    ("Gift Card PSN R$ 100 - economize R$ 15", 100.0),
])
def test_valor_de_face_sem_limite_cashback_nem_lista(titulo, face):
    assert produtos.valor_face(titulo) == face


def test_limite_por_cpf_nao_infla_a_meta():
    o = _post_gift("Gift Card PlayStation Store R$ 150 por R$ 135 - limite de R$ 300 por CPF", 135.0)
    assert produtos.detalhes_de(o)["valor_face"] == 150.0
    a = produtos.alvos_da_oferta(o)
    assert a.pix == 127.5 and not (135.0 <= a.pix)          # 10%: sem 🎯
    (c,) = produtos.cartoes_gift([o])
    assert (c["valor_face"], c["desconto"]) == (150.0, 0.1)   # não R$ 135 de R$ 300 (o limite por CPF)
    cash = _post_gift("Gift Card PlayStation Store R$ 250 por R$ 225 — ganhe R$ 450 em cashback", 225.0, oid="c")
    assert produtos.detalhes_de(cash)["valor_face"] == 250.0
    lista = _post_gift("Gift Card PSN R$ 60, R$ 100 e R$ 300 com 10% OFF na Hype", 54.0, oid="l")
    assert not produtos.detalhes_de(lista).get("valor_face") and produtos.alvos_da_oferta(lista).pix is None


# ---- revisão de 26/10: "hype" solto não é a Hype ------------------------------------------------------------------

@pytest.mark.parametrize("nome", ["HyperX", "HyperX Store", "Hyper Games", "Hypershop", "Mega Hyper Atacado",
                                  "Cyberhype"])
def test_loja_com_hype_no_nome_nao_vira_a_hype(nome):
    from monitor.util import loja_canonica

    assert loja_canonica(nome) != "Hype"


def test_a_hype_continua_a_hype():
    from monitor.util import loja_canonica

    assert {loja_canonica(n) for n in ("Hype", "hype", "Hype Games", "hypegames", "hype.games")} == {"Hype"}
    x = Oferta("promobit", "post", "HyperX Store", "Gift Card PlayStation Store R$ 300 por R$ 240", "u", "hx",
               preco=240.0, modelo="GIFT_CARD_PSN", extra={"produto": {"valor_face": 300.0}})
    assert not produtos._loja_oficial_gift(x) and produtos.alvos_da_oferta(x).pix is None


# ---- revisão de 26/10: cartão pequeno não dá 🎯 falso -----------------------------------------------------------

def _ps_gta(preco=449.90):
    return Oferta("psstore", "loja", "PlayStation Store", "Grand Theft Auto VI", "https://ps/s", "s", preco=preco,
                  vendedor="PlayStation Store", modelo="GTA6_DIGITAL")


def test_cartao_pequeno_fica_sem_meta():
    # o caso real de 21/09: R$ 60 por R$ 35 na loja oficial PlayStation do Mercado Livre
    g = _post_gift("Gift Card PlayStation Store R$ 60 por R$ 35 - Loja oficial PlayStation", 35.0,
                   loja="Mercado Livre", oid="ml")
    assert produtos.alvos_da_oferta(g).pix is None            # cartão abaixo de R$ 100 não é referência
    linhas = produtos.linhas_da_oferta(g)
    assert not any("sairia por" in l for l in linhas) and not any(l.startswith("🔥") for l in linhas)
    assert any("Sem meta: cartão abaixo de R$ 100" in l for l in linhas) and not any("🧮" in l for l in linhas)
    # o GTA 6 digital da PS Store é comparado pelo preço dele (sem conta com gift card)
    gta = _ps_gta()
    assert produtos.preco_comparavel(gta) == 449.90


def test_alerta_da_ps_store_sem_meta_falsa_com_cartao_pequeno(dados):
    _state(dados)
    est = Estado("cloud")
    g = _post_gift("Gift Card PlayStation Store R$ 60 por R$ 35 - Loja oficial PlayStation", 35.0,
                   loja="Mercado Livre", oid="ml")
    msgs, _al = gerar_alertas(est, [_ps_gta(), g], [])
    assert not any("PlayStation Store</b>" in m.split("\n")[0] and "🎯" in m.split("\n")[0] for m in msgs), msgs
    (gm,) = [m for m in msgs if "Gift card" in m.split("\n")[0]]
    assert "sairia por" not in gm and "🔥" not in gm and "🧮" not in gm


def test_resumo_sem_a_linha_proporcional(dados):
    _state(dados)
    est = Estado("cloud")
    txt = resumo_diario(est, [_ps_gta(), _gift("Hype", 150, 120.0, "h150")], [], vigia=True)
    assert "sairia por" not in txt and "🧮" not in txt and "com gift card" not in txt


# ---- revisão de 26/10: gift card de outra região não resgata na conta BR ------------------------------------------

@pytest.mark.parametrize("titulo", [
    "Gift Card PSN US$ 50 Estados Unidos",
    "PlayStation Store Gift Card 100 TRY Turkey",
    "Gift Card PSN Turquia 500 TL",
    "Gift Card PSN UK £20",
    "PSN Card 1000 INR India",
    "Cartão Presente PlayStation Store 20 EUR Portugal",
    "Cartão Presente PlayStation Store 20€",
    "Gift Card PSN R$ 100 Conta Americana",
    "Gift card playstation R$ 100 HK",
    "Gift Card PSN EUA R$ 300",
    "Gift Card PlayStation USD 25",
])
def test_gift_card_de_outra_regiao_fica_de_fora(titulo):
    c = produtos._classifica_titulo(titulo, "")
    assert c.produto is None and c.motivo.startswith("gift card de outra região"), c


@pytest.mark.parametrize("titulo,face", [
    ("R$450 Gift Card PlayStation Store - Cartão Presente [Exclusivo Brasil]", 450.0),
    ("Gift Card PlayStation Store R$ 100 para você usar na sua conta", 100.0),
    ("Sony PlayStation Store Gift Card R$ 100", 100.0),
    ("Cartão PSN R$ 150", 150.0),
    ("Gift Card PlayStation Network 360 BRL", 360.0),
])
def test_gift_card_brasileiro_continua(titulo, face):
    c = produtos._classifica_titulo(titulo, "")
    assert c.produto == "GIFT_CARD_PSN" and c.detalhes.get("valor_face") == face


def test_hype_le_os_cartoes_da_pagina(monkeypatch):
    from monitor.sources import hype

    def cartao(i, face, preco, slug, disponivel="true"):
        return (f'[\\"$\\",\\"$Ld\\",null,{{\\"href\\":\\"/br/product/{slug}\\",\\"children\\":\\"x\\"}}],'
                f'{{\\"gtmProduct\\":{{\\"id\\":{i},\\"sku\\":{i},\\"name\\":\\"R${face} Gift Card PlayStation Store - '
                f'Cartão Presente [Exclusivo Brasil]\\",\\"originalPrice\\":{face},\\"currentPrice\\":{preco},'
                f'\\"brand\\":\\"Sony\\",\\"avaliable\\":{disponivel},\\"seller\\":\\"Sony\\",\\"currency\\":\\"BRL\\"}}}}')

    html = ("<html><script>self.__next_f.push([1,\"" + cartao(1, 450, 405, "450-playstation-store") +
            cartao(2, 550, 550, "550-playstation-store") + cartao(3, 700, 700, "700-psn", "false") +
            '{\\"gtmProduct\\":{\\"id\\":9,\\"name\\":\\"R$100 Gift Card Xbox\\",\\"currentPrice\\":90}}' +
            "\"])</script></html>")
    ofs = {o.id: o for o in hype.parse_pagina(html)}
    assert set(ofs) == {"1", "2", "3"}   # o Xbox não é o gift card da PlayStation
    a = ofs["1"]
    assert (a.loja, a.vendedor, a.preco, a.modelo, a.extra["produto"]["valor_face"]) == (
        "Hype", "Hype", 405.0, "GIFT_CARD_PSN", 450.0)
    assert a.url == "https://hype.games/br/product/450-playstation-store" and ofs["3"].ativo is False
    assert produtos._loja_oficial_gift(a) and produtos.alvos_da_oferta(a).pix == 382.5
    monkeypatch.setattr(hype, "get_html", lambda url, **k: html)
    assert len(hype.HypeGiftCard().coletar()[0]) == 3
    monkeypatch.setattr(hype, "get_html", lambda url, **k: "<html></html>")
    with pytest.raises(RuntimeError):
        hype.HypeGiftCard().coletar()


def _lista_kabum(itens):
    dados = {"catalogServer": {"data": itens}}
    nd = {"props": {"pageProps": {"data": json.dumps(dados)}}}
    return f'<script id="__NEXT_DATA__" type="application/json">{json.dumps(nd)}</script>'


def test_kabum_produtos_le_a_lista_dos_gift_cards(monkeypatch):
    from monitor.sources import kabum

    gift = [{"code": 1059584, "name": "R$450 PlayStation Store - Cartão Presente Digital [Brasil]", "price": 450.0,
             "priceWithDiscount": 405.0, "available": True, "flags": {}, "sellerName": "KaBuM!"},
            {"code": 777, "name": "R$300 PlayStation Store - Cartão Presente Digital [Brasil]", "price": 300.0,
             "priceWithDiscount": 240.0, "available": True, "flags": {"isMarketplace": True},
             "sellerName": "Loja Parceira X", "sellerId": 99}]
    pedidas = []

    def get_html(url, **k):
        pedidas.append(url)
        return _lista_kabum(gift if url == config.URL_KABUM_LISTA_GIFT else [])

    monkeypatch.setattr(kabum, "get_html", get_html)
    monkeypatch.setattr(kabum, "get_json", lambda url, **k: (_ for _ in ()).throw(ConnectionError("sem rede")))
    ofs = {o.id: o for o in kabum.KaBuMProdutos().coletar()[0]}
    assert config.URL_KABUM_LISTA_GIFT in pedidas
    a, parceiro = ofs["1059584"], ofs["777"]
    assert (a.modelo, a.vendedor, a.preco_pix, a.extra["produto"]["valor_face"]) == (
        "GIFT_CARD_PSN", "KaBuM!", 405.0, 450.0)
    assert produtos._loja_oficial_gift(a)
    assert not produtos._loja_oficial_gift(parceiro)   # parceiro do marketplace da KaBuM: não é oficial
    assert produtos.alvos_da_oferta(parceiro).nota == "loja não oficial para gift card"


def test_lojas_oficiais_do_gift_card():
    of = produtos._loja_oficial_gift
    assert of(_gift("Hype", 450, 405, "h")) and of(_gift("Nuuvem", 300, 270, "n", tipo="post"))
    assert of(_gift("Americanas", 100, 90, "a", vendedor="Americanas"))
    assert not of(_gift("Amazon", 100, 85, "z", tipo="post"))     # postagem que não diz quem vende
    texto = {"texto": "Gift card PSN R$ 100 vendido e entregue por Amazon.com.br"}
    assert of(Oferta("pelando", "post", "Amazon", "Gift card PSN R$ 100", "u", "z2", preco=85.0, modelo="GIFT_CARD_PSN",
                     extra={"produto": {"valor_face": 100.0}, **texto}))
    assert not of(_gift("Eneba", 300, 230, "e", tipo="post"))
    assert not of(_gift("Magazine Luiza", 100, 80, "m", vendedor="Loja Qualquer"))


def test_meta_do_gift_card_pela_pesquisa():
    h = _gift("Hype", 450, 405, "h")
    a = produtos.alvos_da_oferta(h)                                       # 15%, em qualquer data
    assert a.pix == 382.5 and a.nota == "15% de desconto sobre R$ 450"
    peq = produtos.alvos_da_oferta(_gift("Hype", 60, 35, "p"))
    assert peq.pix is None and "abaixo de R$ 100" in peq.nota
    assert produtos.gift_sem_alerta(_gift("Hype", 450, 430, "x"))          # 4,4%: sem alerta
    assert not produtos.gift_sem_alerta(_gift("Hype", 450, 405, "y"))      # 10%
    sem_face = Oferta("promobit", "post", "Shopee", "6% OFF em gift card PlayStation", "u", "s", modelo="GIFT_CARD_PSN")
    assert not produtos.gift_sem_alerta(sem_face)


def test_bloco_do_gift_card_para_o_painel():
    ofs = [_gift("Hype", 450, 405.0, "a"), _gift("Hype", 550, 495.0, "b"), _gift("Eneba", 300, 220.0, "e", tipo="post")]
    bloco = produtos.gift_para_painel(ofs)
    assert bloco["melhor"]["valor_face"] in (450.0, 550.0) and bloco["melhor"]["desconto"] == 0.1
    assert len(bloco["cartoes"]) == 2                          # a Eneba não é loja oficial
    assert set(bloco) == {"melhor", "cartoes", "regra", "lojas_oficiais"}   # sem a conta do GTA 6
    assert bloco["regra"]["meta"] == 0.15 and "prazo" not in bloco["regra"]


def test_alerta_do_gift_card_so_com_desconto(dados):
    _state(dados)
    est = Estado("cloud")
    cheio = _gift("Hype", 450, 450.0, "cheio")
    pouco = _gift("KaBuM!", 300, 290.0, "pouco")
    bom = _gift("Hype", 550, 467.0, "bom")          # 15,1%
    ofs, _ = sanear([cheio, pouco, bom])
    msgs, _al = gerar_alertas(est, ofs, [])
    assert len(msgs) == 1, msgs
    m = msgs[0]
    assert m.startswith("🆕 Nova oferta 🎯 Abaixo do alvo · Gift card PlayStation") or "🎯" in m.split("\n")[0]
    assert "Meta: Pix R$ 467,50" in m and "🧮" not in m and "⏰" not in m
    # postagem de gift card com 5% de desconto: sem alerta
    est2 = Estado("cloud")
    post, _ = sanear([_gift("Nuuvem", 300, 285.0, "p5", tipo="post")])
    assert gerar_alertas(est2, post, [])[0] == []


def test_resumo_mostra_o_melhor_gift_card(dados):
    _state(dados)
    est = Estado("cloud")
    txt = resumo_diario(est, [_gift("Hype", 450, 382.0, "a")], [], vigia=True)
    assert "<b>Gift card PSN</b>: R$ 382,00 (Hype)" in txt and "🧮" not in txt


def test_latest_publica_o_bloco_do_gift_card(dados, sem_tvs):
    _state(dados)
    est = Estado("cloud")
    ofs, _ = sanear([_gift("Hype", 450, 382.0, "a"), _gift("KaBuM!", 100, 99.0, "b")])
    est.escreve_latest(ofs, [])
    latest = json.loads((dados / "latest_cloud.json").read_text(encoding="utf-8"))
    g = latest["gift_card_psn"]
    assert g["melhor"]["loja"] == "Hype" and g["melhor"]["preco"] == 382.0 and "gta" not in g
    assert latest["tvs_desligadas"] is True


# =====================================================================================================================
# painel (painel/src/logica.js no Node, como em tests/test_painel.py)
# =====================================================================================================================

NODE = shutil.which("node")


def _painel(tmp_path, cloud, pc=None, agora="2026-10-26T12:00:00-03:00"):
    import test_painel as tp

    arquivos = {"data/latest_cloud.json": cloud}
    if pc is not None:
        arquivos["data/latest_pc.json"] = pc
    out = tp.roda_modelo(tmp_path, arquivos, agora)
    vm = out["vm"]
    fam = {f["sec"]: f for f in vm["familias"]}
    r = vm["resumo"]
    return {**out, "sem_tvs": vm["tvs"] is None, "f-posts": r["posts"]["v"],
            "f-gift": r["gift"]["v"], "f-gift-s": r["gift"]["s"], "ps5": fam.get("PS5"), "gta": fam.get("GTA6")}


def _latest(sem_tvs_flag, gift=None, posts=(), cupons=()):
    d = {"modo": "cloud", "atualizado": "2026-10-26T11:50:00-03:00", "produtos": produtos.para_painel(sem_tvs_flag),
         "ofertas_loja": [], "posts": list(posts), "cupons": list(cupons), "saude": {},
         "confianca": {"reprovados": []}}
    if sem_tvs_flag:
        d["tvs_desligadas"] = True
    else:
        d.update({"alvo_pix": 2900.0, "alvo_parcelado": 3000.0, "alvos": config.alvos()})
    if gift is not None:
        d["gift_card_psn"] = gift
    return d


_POSTS = [{"chave": "p:tv", "fonte": "promobit", "tipo": "post", "loja": "Amazon", "titulo": "Smart TV TCL 65C6K",
           "url": "https://p/tv", "melhor_preco": 3000.0, "modelo": "65C6K", "publicado": "2026-10-26T10:00:00-03:00"},
          {"chave": "p:ps5", "fonte": "promobit", "tipo": "post", "loja": "Netshoes", "titulo": "PS5 Slim Digital",
           "url": "https://p/ps5", "melhor_preco": 3499.0, "modelo": "PS5_DIGITAL",
           "publicado": "2026-10-26T10:00:00-03:00"}]
_CUPONS = [{"loja": "Magazine Luiza", "codigo": "TV100", "titulo": "R$ 100 OFF na TV", "url": "u", "fonte": "magalu",
            "especifico": True, "modelo": "55C6K"},
           {"loja": "Magazine Luiza", "codigo": "PS5200", "titulo": "R$ 200 OFF", "url": "u", "fonte": "magalu",
            "especifico": True, "modelo": "PS5_DIGITAL"}]


@pytest.mark.skipif(NODE is None, reason="node não encontrado no PATH")
def test_painel_sem_tvs_esconde_a_parte_das_tvs(tmp_path):
    s = _painel(tmp_path, _latest(True, posts=_POSTS, cupons=_CUPONS))
    assert s["sem_tvs"] is True and not [it for it in s["vm"]["vitrine"] if it["familia"] == "TV"]
    assert "TCL 65C6K" not in s["l-posts"] and "PS5 Slim Digital" in s["l-posts"]
    assert "TV100" not in s["l-cupons"] and "PS5200" in s["l-cupons"]
    assert str(s["f-posts"]) == "1"


@pytest.mark.skipif(NODE is None, reason="node não encontrado no PATH")
def test_painel_basta_um_modo_com_o_sinal(tmp_path):
    s = _painel(tmp_path, _latest(False, posts=_POSTS), _latest(True))
    assert s["sem_tvs"] is True


@pytest.mark.skipif(NODE is None, reason="node não encontrado no PATH")
def test_painel_sem_o_sinal_continua_com_as_tvs(tmp_path):
    s = _painel(tmp_path, _latest(False, posts=_POSTS, cupons=_CUPONS))
    assert s["sem_tvs"] is False and s["vm"]["tvs"]["modelos"].keys() == {"55C6K", "65C6K"}
    assert "TCL 65C6K" in s["l-posts"] and "TV100" in s["l-cupons"]


@pytest.mark.skipif(NODE is None, reason="node não encontrado no PATH")
def test_painel_mostra_o_melhor_gift_card(tmp_path):
    ofs = [_gift("Hype", 450, 382.0, "a"), _gift("Hype", 550, 495.0, "b"), _gift("KaBuM!", 300, 270.0, "c")]
    gift = json.loads(json.dumps(produtos.gift_para_painel(ofs)))
    s = _painel(tmp_path, _latest(True, gift=gift))
    assert s["f-gift"] == "R$ 382,00" and "vale R$ 450" in s["f-gift-s"] and "15%" in s["f-gift-s"]
    assert "giftStd" not in s["vm"]["resumo"] and "giftUlt" not in s["vm"]["resumo"]   # sem a conta do GTA 6
    # 26/11/2026: o bloco do gift card fica na seção do PS5 (antes, na do GTA 6)
    g = s["ps5"]["gift"]
    assert g["melhor"]["preco"] == "R$ 382,00" and g["melhor"]["naMeta"] and g["regra"]["meta"] == "15%"
    assert [c["naMeta"] for c in g["cartoes"]] == [True, False, False] and "gta" not in g
    assert s["gta"]["gift"] is None
    # o gift card não tem gráfico (mistura valores de face)
    assert "chart-GIFT_CARD_PSN" not in s["graficos"]


@pytest.mark.skipif(NODE is None, reason="node não encontrado no PATH")
def test_painel_sem_gift_card_com_desconto(tmp_path):
    s = _painel(tmp_path, _latest(True, gift=produtos.gift_para_painel([])))
    assert s["f-gift"] == "—" and "nenhum com desconto" in s["f-gift-s"]
    assert s["ps5"]["gift"]["melhor"] is None and s["ps5"]["gift"]["cartoes"] == []
