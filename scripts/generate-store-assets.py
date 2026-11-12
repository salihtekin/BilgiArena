"""Export approved brand assets and actual native view renders for Play Console."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'release/play-store/graphics';out.mkdir(parents=True,exist_ok=True)
fonts=root/'mobile/app/src/main/assets/fonts'
def font(name,size):return ImageFont.truetype(str(fonts/(name+'.ttf')),size)
paper='#a0d3d7';ink='#192c34'
icon=Image.new('RGBA',(512,512),paper)
mark=Image.open(root/'public/app-icon.png').convert('RGBA').resize((512,512),Image.Resampling.LANCZOS);icon.paste(mark,(0,0),mark);icon.save(out/'icon-512.png')
graphic=Image.new('RGB',(1024,500),paper);d=ImageDraw.Draw(graphic)
d.text((44,30),'bilgiarena',font=font('dela',32),fill=ink)
d.text((42,114),'Merakına',font=font('dela',57),fill=ink)
d.text((42,188),'bir oyun aç.',font=font('dela',57),fill=ink)
d.text((47,316),'KELİME  ·  HAFIZA  ·  BİLGİ',font=font('rubik-500',20),fill=ink)
d.rounded_rectangle((44,378,375,438),radius=20,fill=ink)
d.text((67,396),'6 oyun. Kısa turlar.',font=font('rubik-500',23),fill='#fffdf1')
d.rounded_rectangle((639,47,982,453),radius=36,fill='#fff3d4')
art=Image.open(root/'public/art/reverse.png').convert('RGBA');art.thumbnail((330,330),Image.Resampling.LANCZOS);graphic.paste(art,(646,64),art)
d.text((692,385),'TERS KÖŞE',font=font('rubik-700',28),fill=ink)
graphic.save(out/'feature-1024x500.png',optimize=True)
screens=root/'mobile/app/build/outputs/play-store'
for p in sorted(screens.glob('*.png')):
 im=Image.open(p);assert im.size==(1080,1920),(p,im.size);im.convert('RGB').save(out/p.name,optimize=True)
print('Store graphics exported; native renders:',len(list(screens.glob('*.png'))))
