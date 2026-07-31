# -*- coding: utf-8 -*-
"""Normaliza el Excel QA/QC INSUMOS a tablas planas: equipos + consumibles."""
import openpyxl, json, re, unicodedata
from collections import Counter

SRC = '/sessions/jolly-bold-sagan/mnt/.projects/019fb4e6-c315-7709-9d92-945bb9d3781b/files/986a8a93-22ff-40b6-b09a-33f4965a4a6e.xlsx'
OUT = '/sessions/jolly-bold-sagan/mnt/outputs/maxim-qaqc'

wb = openpyxl.load_workbook(SRC, data_only=True)

def clean(s):
    if s is None: return ''
    return re.sub(r'\s+', ' ', str(s)).strip()

def norm_key(s):
    s = clean(s).upper()
    return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn')

FAMILIAS = [
    ('STANDING VALVE','STANDING VALVE'),('BLANKING PLUG FWG','BLANKING PLUG FWG RZG'),
    ('BLANKING PLUG','BLANKING PLUG'),('HIDRAULIC POWER JAR','HYDRAULIC POWER JAR'),
    ('MARTILLO HIDRAULICO','MARTILLO HIDRAULICO'),('N-TEST','N-TEST TOOL'),('NTEST','N-TEST TOOL'),
    ('TOOL TRAP','TOOL TRAP'),('TOOL CATCHER','TOOL CATCHER'),('TREE CON','TREE CONNECTION'),
    ('STUFFING BOX','STUFFING BOX'),('STUFING BOX','STUFFING BOX'),('PUMP IN SUB','PUMP IN SUB'),
    ('PUN IN SUB','PUMP IN SUB'),('LUBRICADOR','LUBRICADOR'),('LIBRICADOR','LUBRICADOR'),
    ('BOP','BOP'),('CIG','CIG'),('CGI','CIG'),
]
def familia_de(nombre):
    k = norm_key(nombre)
    for pat,fam in FAMILIAS:
        if pat in k: return fam
    return clean(nombre).upper()

def extraer_medida(s):
    m = re.search(r'(\d+)\s+(\d+)-(\d+)', s)
    if m: return f'{m.group(1)} {m.group(2)}/{m.group(3)}"'
    m = re.search(r'(\d+)[.,](\d+)\s*"?', s)
    if m: return f'{m.group(1)}.{m.group(2)}"'
    m = re.search(r'\b(\d+)-(\d+)\b', s)
    if m: return f'{m.group(1)}/{m.group(2)}"'
    return ''

PCE_FAMS = {'BOP','CIG','TOOL TRAP','TOOL CATCHER','TREE CONNECTION','STUFFING BOX','PUMP IN SUB','LUBRICADOR','N-TEST TOOL'}
equipos, consumibles, avisos = [], [], []
eid = 0

for ws in wb.worksheets:
    rows = [[clean(c) for c in r] for r in ws.iter_rows(values_only=True)]
    rows = [r for r in rows if any(r)]
    if not rows: continue
    titulo = rows[0][0] if rows[0] and rows[0][0] else ws.title
    familia = familia_de(titulo + ' ' + ws.title)
    medida = extraer_medida(ws.title)

    hdr_idx = None
    for i,r in enumerate(rows[:4]):
        keys=[norm_key(c) for c in r]
        if 'CATEGORIA' in keys or ('TIPO' in keys and 'CANTIDAD' in keys):
            hdr_idx=i; break
    if hdr_idx is None:
        avisos.append(f'{ws.title}: no se encontro encabezado, hoja omitida'); continue

    header=[norm_key(c) for c in rows[hdr_idx]]
    def cix(n): return header.index(n) if n in header else None
    ic_cat,ic_fab,ic_tipo,ic_cant,ic_ref = cix('CATEGORIA'),cix('FABRICANTE'),cix('TIPO'),cix('CANTIDAD'),cix('REFERENCIA')
    ic_ficha = next((header.index(x) for x in ('FICHA TECNICA',) if x in header), None)

    fab_default=''
    mfab=re.search(r'(BAOJI JINHUI|BAOJI VEXAH|BAOJI SAFE|ADVISORY|ENVIRO|BOWEN|BRACE TOOLS|FHE|PSI|CR|ELMAR|TIC|TOOLS UNIVERSAL)', ws.title.upper())
    if mfab: fab_default=mfab.group(1)

    eid+=1
    ficha=''; grupo=''; cat_vals=[]; fab_vals=[]; nc=0
    # subseccion inicial (etiqueta que aparece justo antes del encabezado, ej. BRAZO DE BOP)
    if hdr_idx>=1:
        prev=[x for x in rows[hdr_idx-1] if x]
        if len(prev)==1 and hdr_idx-1!=0:
            grupo=prev[0]
    def es_subseccion(r):
        ne=[x for x in r if x]
        if len(ne)!=1: return False
        sin_cant = ic_cant is None or ic_cant>=len(r) or not r[ic_cant]
        sin_ref  = ic_ref  is None or ic_ref>=len(r)  or not r[ic_ref]
        return sin_cant and sin_ref
    for r in rows[hdr_idx+1:]:
        nonempty=[x for x in r if x]
        if es_subseccion(r):
            grupo=nonempty[0]; continue
        rkeys=[norm_key(c) for c in r]
        if 'TIPO' in rkeys and 'CANTIDAD' in rkeys: continue
        tipo=clean(r[ic_tipo]) if ic_tipo is not None and ic_tipo<len(r) else ''
        if not tipo or norm_key(tipo).startswith('COLUMNA'): continue
        cant=clean(r[ic_cant]) if ic_cant is not None and ic_cant<len(r) else ''
        ref=clean(r[ic_ref]) if ic_ref is not None and ic_ref<len(r) else ''
        if ic_cat is not None and ic_cat<len(r) and r[ic_cat]: cat_vals.append(clean(r[ic_cat]).upper())
        if ic_fab is not None and ic_fab<len(r) and r[ic_fab]: fab_vals.append(clean(r[ic_fab]))
        if ic_ficha is not None and ic_ficha<len(r) and clean(r[ic_ficha]): ficha=clean(r[ic_ficha])
        nc+=1
        consumibles.append({'equipo_id':eid,'grupo':grupo,'tipo':tipo,'cantidad':cant,'referencia':ref})

    categoria = Counter(cat_vals).most_common(1)[0][0] if cat_vals else ('PCE' if familia in PCE_FAMS else 'HTA')
    fabricante = Counter(fab_vals).most_common(1)[0][0] if fab_vals else fab_default

    # avisos de calidad
    fam_tit = familia_de(titulo)
    fam_hoja = familia_de(ws.title)
    if fam_tit != fam_hoja:
        avisos.append(f'{ws.title}: el titulo interno dice "{titulo}" pero la hoja sugiere familia {fam_hoja} (posible error de copiado en el Excel)')
    if nc==0:
        avisos.append(f'{ws.title}: sin consumibles')

    equipos.append({'id':eid,'categoria':categoria,'familia':familia,'nombre':titulo,'medida':medida,
                    'fabricante':fabricante,'ficha_tecnica':ficha,'hoja_origen':ws.title,'num_consumibles':nc})

# combinado para la app (fallback demo)
combinado=[]
cons_by=({})
for c in consumibles: cons_by.setdefault(c['equipo_id'],[]).append(c)
for e in equipos:
    ee=dict(e); ee['consumibles']=cons_by.get(e['id'],[]); combinado.append(ee)

json.dump(equipos, open(f'{OUT}/data/equipos.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(consumibles, open(f'{OUT}/data/consumibles.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)
json.dump(combinado, open(f'{OUT}/data/data.json','w',encoding='utf-8'), ensure_ascii=False, indent=2)

print('EQUIPOS:',len(equipos),'| CONSUMIBLES:',len(consumibles))
print('Categorias:',Counter(e['categoria'] for e in equipos))
print('Fabricantes:',Counter(e['fabricante'] for e in equipos))
print('Con ficha:',sum(1 for e in equipos if e['ficha_tecnica']))
print('\n--- AVISOS DE CALIDAD ---')
for a in avisos: print('*',a)
