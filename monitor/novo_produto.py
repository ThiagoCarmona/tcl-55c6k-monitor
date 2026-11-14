"""Pedido do botão ➕ do painel -> monitor/produtos_extras.json (workflow novo-produto.yml, 14/11/2026).

Uso: python -m monitor.novo_produto <arquivo com o corpo da issue> <número da issue>
Imprime a resposta para a issue; sai com 1 quando o pedido é inválido (nada é gravado).
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date

from . import produtos

# rótulos do formulário (painel/src/main.jsx, CAMPOS_PEDIDO) -> chave
_ROTULOS = {"produto": "nome", "precisa ter": "tem", "nao serve": "fora", "meta a vista": "pix",
            "meta parcelada": "parcelado"}


def le_pedido(corpo: str) -> dict:
    out: dict = {}
    for rot, valor in re.findall(r"\*\*(.+?):\*\*\s*(.*)", corpo):
        rot = produtos.normaliza(rot)
        chave = next((k for r, k in _ROTULOS.items() if rot == r or (r != "produto" and r in rot)), None)
        if chave:
            out[chave] = valor.strip()
    return out


def _numero(v: str) -> float:
    return float(re.sub(r"[^\d.,]", "", v).replace(",", "."))


def monta_entrada(pedido: dict, issue: str, existentes: dict) -> dict:
    """A entrada do catálogo; ValueError com a explicação quando o pedido não serve."""
    nome = re.sub(r"\s+", " ", pedido.get("nome", "")).strip()
    if not 3 <= len(nome) <= 80:
        raise ValueError("o nome do produto precisa ter de 3 a 80 caracteres")
    try:
        pix = _numero(pedido.get("pix", ""))
        parcelado = _numero(pedido["parcelado"]) if pedido.get("parcelado") else None
    except ValueError:
        raise ValueError("a meta precisa ser um número em reais") from None
    if not 1 <= pix <= 100000 or (parcelado is not None and not pix <= parcelado <= 100000):
        raise ValueError("meta fora do esperado (Pix de R$ 1 a R$ 100.000; o parcelado não pode ser menor que o Pix)")
    pid = "X_" + re.sub(r"[^A-Z0-9]+", "_", produtos.normaliza(nome).upper()).strip("_")[:40]
    if pid in existentes or any(produtos.normaliza(p.nome) == produtos.normaliza(nome) for p in existentes.values()):
        raise ValueError(f"já existe um produto com esse nome ({pid})")
    lista = lambda k: [x.strip() for x in re.split(r";|,(?!\d)", pedido.get(k, "")) if x.strip()]  # noqa: E731
    return {"id": pid, "nome": nome, "tem": lista("tem"), "fora": lista("fora"), "pix": pix, "parcelado": parcelado,
            "pedido": f"issue #{issue}, {date.today().isoformat()}"}


def main(arquivo: str, issue: str) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    with open(arquivo, encoding="utf-8") as f:
        pedido = le_pedido(f.read())
    try:
        e = monta_entrada(pedido, issue, produtos.PRODUTOS)
    except ValueError as erro:
        print(f"❌ Pedido não incluído: {erro}. Corrija pelo ➕ do painel e envie de novo.")
        return 1
    extras = json.loads(produtos.ARQUIVO_EXTRAS.read_text(encoding="utf-8"))
    extras.append(e)
    produtos.ARQUIVO_EXTRAS.write_text(json.dumps(extras, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    termos = ", ".join(produtos.termos_obrigatorios(e))
    print(f"✅ **{e['nome']}** entrou no catálogo do robô (`{e['id']}`).\n\n"
          f"- Meta Pix: R$ {e['pix']:.2f}" + (f" · parcelado: R$ {e['parcelado']:.2f}" if e["parcelado"] else "") +
          f"\n- O título precisa ter: {termos}" + (f"\n- Fica fora: {', '.join(e['fora'])}" if e["fora"] else "") +
          "\n- Busca: Promobit, Pelando, Magalu, Telegram e KaBuM. Uma coleta nova já foi disparada; o produto aparece "
          "no painel quando ela terminar.\n\nPara tirar o produto, apague a entrada dele em "
          "`monitor/produtos_extras.json`.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
