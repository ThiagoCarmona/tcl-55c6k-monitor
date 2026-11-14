"""Produtos pedidos pelo botão ➕ do painel (14/11/2026): issue -> monitor/produtos_extras.json -> catálogo."""

from __future__ import annotations

import json

import pytest

from monitor import novo_produto, produtos

# o corpo como o painel monta (painel/src/main.jsx, BotaoNovoProduto)
CORPO = ("**Produto:** Air Fryer Philips 6,2L\n\n**O que o título precisa ter (separe por vírgula):** air fryer, "
         "philips, 6,2 l\n\n**O que não serve (separe por vírgula):** usado; walita\n\n**Meta à vista / Pix (R$):** 400"
         "\n\n**Meta parcelada (R$, opcional):** 430\n\n_Pedido feito pelo botão ➕ do painel._")
EXTRA = {"id": "X_AIR_FRYER", "nome": "Air Fryer Philips", "tem": ["air fryer", "philips"], "fora": ["walita", "cesto"],
         "pix": 400.0, "parcelado": None}


def test_le_o_pedido_do_painel():
    p = novo_produto.le_pedido(CORPO)
    assert p == {"nome": "Air Fryer Philips 6,2L", "tem": "air fryer, philips, 6,2 l", "fora": "usado; walita",
                 "pix": "400", "parcelado": "430"}
    e = novo_produto.monta_entrada(p, "7", produtos.PRODUTOS)
    assert e["id"] == "X_AIR_FRYER_PHILIPS_6_2L"
    assert e["tem"] == ["air fryer", "philips", "6,2 l"]   # vírgula de número decimal não separa
    assert produtos.classifica_extra("air fryer philips 6,2l preta", [e]).produto == e["id"]
    assert e["fora"] == ["usado", "walita"] and e["pix"] == 400.0 and e["parcelado"] == 430.0


@pytest.mark.parametrize("pedido, erro", [
    ({"nome": "x", "pix": "10"}, "nome"),
    ({"nome": "Air Fryer", "pix": "abc"}, "número"),
    ({"nome": "Air Fryer", "pix": "500", "parcelado": "400"}, "parcelado"),
    ({"nome": "ssd nvme m.2 1tb", "pix": "500"}, "já existe"),
])
def test_pedido_invalido(pedido, erro):
    with pytest.raises(ValueError, match=erro):
        novo_produto.monta_entrada(pedido, "1", produtos.PRODUTOS)


def test_main_grava_e_recusa(tmp_path, monkeypatch, capsys):
    arq = tmp_path / "extras.json"
    arq.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(produtos, "ARQUIVO_EXTRAS", arq)
    corpo = tmp_path / "corpo.md"
    corpo.write_text(CORPO, encoding="utf-8")
    assert novo_produto.main(str(corpo), "7") == 0
    assert json.loads(arq.read_text(encoding="utf-8"))[0]["pedido"].startswith("issue #7")
    assert "entrou no catálogo" in capsys.readouterr().out
    corpo.write_text("**Produto:** Air Fryer", encoding="utf-8")   # sem meta
    assert novo_produto.main(str(corpo), "8") == 1
    assert len(json.loads(arq.read_text(encoding="utf-8"))) == 1


@pytest.mark.parametrize("titulo, esperado", [
    ("Fritadeira Air Fryer Philips Walita 4,1L", "fora do pedido: walita"),
    ("Air Fryer Philips Série 3000 6,2L Preta 127V", "X_AIR_FRYER"),
    ("AIRFRYER philips 4L", "X_AIR_FRYER"),  # "airfryer" e "air-fryer" valem "air fryer"
    ("Air Fryer Mondial 5L", None),          # sem philips: não é este
    ("Air Fryer Philips usada", "estado: usada"),
    ("Cesto para Air Fryer Philips", "fora do pedido: cesto"),
])
def test_classifica_extra(titulo, esperado):
    c = produtos.classifica_extra(produtos.normaliza(titulo), [EXTRA])
    got = None if c is None else (c.produto or c.motivo)
    assert got == esperado


def test_termo_com_numero_aceita_espaco():
    e = {"id": "X_SSD2", "nome": "SSD 2TB", "tem": ["ssd", "2tb"]}
    assert produtos.classifica_extra("ssd kingston nv3 2 tb", [e]).produto == "X_SSD2"
    # sem termos, valem as palavras do nome
    assert produtos.termos_obrigatorios({"nome": "Cadeira de Escritório"}) == ["cadeira", "escritorio"]


@pytest.fixture
def com_extra(monkeypatch):
    monkeypatch.setitem(produtos.PRODUTOS, EXTRA["id"], produtos.produto_extra(EXTRA))
    monkeypatch.setattr(produtos, "EXTRAS", [EXTRA])
    from monitor import config, regras

    # no uso real o config é montado depois dos extras (config.ALVOS_PRODUTOS já os inclui)
    monkeypatch.setitem(config.ALVOS_PRODUTOS, EXTRA["id"], {"pix": 400.0, "parcelado": 428.0})

    regras._perfil_extra.cache_clear()
    yield regras
    regras._perfil_extra.cache_clear()


def test_produto_extra_no_catalogo(com_extra):
    p = produtos.produto("X_AIR_FRYER")
    assert (p.familia, p.secao, p.alvo_pix, p.alvo_parcelado) == ("EXTRA", "Air Fryer Philips", 400.0, 428.0)
    assert produtos.preco_plausivel("X_AIR_FRYER", 350) and not produtos.preco_plausivel("X_AIR_FRYER", 50)
    assert "air fryer philips" in produtos.termos("promobit", ["EXTRA"])


def test_painel_mostra_o_extra(com_extra, tmp_path):
    """O produto do ➕ vira seção própria do painel (título = nome) e pílula na vitrine, sem nada fixo no painel."""
    import test_painel as tp

    o = tp.oferta("kabum", "KaBuM!", 449.9, 389.0, oid="AF62")
    o.update(modelo="X_AIR_FRYER", titulo="Air Fryer Philips Série 3000 6,2L")
    cloud = tp.latest("cloud", tp.CLOUD_AT, [*tp.ofertas_cloud_hoje(), o], tp.MIN_MAGALU)
    cloud["produtos"] = produtos.para_painel()
    out = tp.roda_painel(tmp_path, cloud, tp.latest("pc", tp.PC_AT, tp.ofertas_pc_hoje(), tp.MIN_AMAZON))
    fam = {f["sec"]: f for f in out["vm"]["familias"]}
    (linha,) = fam["Air Fryer Philips"]["resumo"]
    assert fam["Air Fryer Philips"]["titulo"] == "Air Fryer Philips" and linha["meta"]["v"] == tp.brl(400.0)
    assert "X_AIR_FRYER" in [it["id"] for it in out["vm"]["vitrine"]]


@pytest.mark.parametrize("titulo, ok", [
    ("10% OFF em todo o site", True),
    ("R$ 50 OFF em Air Fryer", True),
    ("15% OFF em moda feminina", False),
    ("10% OFF em celulares", False),
])
def test_cupom_do_extra(com_extra, titulo, ok):
    from monitor.models import Cupom

    c = Cupom("promobit", "Amazon", "CUPOM10", titulo, "https://c", "CUPOM10")
    assert com_extra.cupom_compativel(c, 400.0, "X_AIR_FRYER")[0] is ok


def test_arquivo_do_repositorio_e_valido():
    extras = json.loads(produtos.ARQUIVO_EXTRAS.read_text(encoding="utf-8"))
    assert isinstance(extras, list)
    for e in extras:
        assert e["id"].startswith("X_") and e["pix"] > 0 and produtos.produto_extra(e).familia == "EXTRA"
