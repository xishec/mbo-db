from pathlib import Path
from lxml import etree
import zipfile, re, tempfile, sys

W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; NS={'w':W}
TARGET={'Fe9E0lE3','bnPvNUHf','9lb7E2xA'}

def xml(path):
    with zipfile.ZipFile(path) as z:return etree.fromstring(z.read('word/document.xml'))
def codes(path):
    out={}
    for n in xml(path).xpath('//w:instrText',namespaces=NS):
        s=''.join(n.itertext())
        if 'ADDIN ZOTERO_ITEM CSL_CITATION' in s:
            cid=re.search(r'"citationID":"([^"]+)',s).group(1)
            out[cid]=s.split('ADDIN ZOTERO_',1)[1].strip()
    return out
def main(gt, complete, out):
    root=xml(gt); good=codes(complete); old=codes(Path('/Users/xicshen/Downloads/CH1_Final_Revisions_05-10-2026.docx'))
    active=None; inserted=set(); remove=[]; replace=[]
    for run in root.xpath('//w:body//w:r',namespaces=NS):
        t=''.join(run.xpath('w:t/text()',namespaces=NS)); m=re.search(r'ITEM CSL_CITATION \{"citationID":"([^"]+)',t)
        if m:
            active=m.group(1) if m.group(1) in TARGET else None
            if active:
                inserted.add(active); remove.append(run); replace.append((run,good[active]))
                continue
        if active and t:
            # Remove only fragments proven to belong to that broken source payload.
            if len(t)>15 and t in old[active]: remove.append(run)
    if inserted!=TARGET: raise RuntimeError(inserted)
    for run,text in replace:
        parent=run.getparent(); i=parent.index(run); nr=etree.Element('{%s}r'%W)
        begin=etree.Element('{%s}r'%W); etree.SubElement(begin,'{%s}fldChar'%W,{'{%s}fldCharType'%W:'begin'})
        parent.insert(i,begin); i+=1
        node=etree.SubElement(nr,'{%s}instrText'%W); node.set('{http://www.w3.org/XML/1998/namespace}space','preserve'); node.text=' ADDIN ZOTERO_'+text+' '
        parent.insert(i,nr); i+=1
        sep=etree.Element('{%s}r'%W); etree.SubElement(sep,'{%s}fldChar'%W,{'{%s}fldCharType'%W:'separate'}); parent.insert(i,sep); i+=1
        result=etree.Element('{%s}r'%W); value=re.search(r'"formattedCitation":"([^"]+)',text).group(1); etree.SubElement(result,'{%s}t'%W).text=value; parent.insert(i,result); i+=1
        end=etree.Element('{%s}r'%W); etree.SubElement(end,'{%s}fldChar'%W,{'{%s}fldCharType'%W:'end'}); parent.insert(i,end)
    for run in remove:
        if run.getparent() is not None:run.getparent().remove(run)
    with tempfile.TemporaryDirectory() as td:
        stage=Path(td)
        with zipfile.ZipFile(gt) as z:z.extractall(stage)
        etree.ElementTree(root).write(stage/'word/document.xml',encoding='UTF-8',xml_declaration=True,standalone=True)
        with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
            for p in stage.rglob('*'):
                if p.is_file():z.write(p,p.relative_to(stage))
    print('fixed',sorted(inserted),'removed',len(remove))
if __name__=='__main__':main(Path(sys.argv[1]),Path(sys.argv[2]),Path(sys.argv[3]))
