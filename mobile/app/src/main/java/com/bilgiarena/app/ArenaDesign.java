package com.bilgiarena.app;

import android.content.Context;
import android.graphics.*;
import android.os.SystemClock;
import android.view.View;
import android.widget.ImageView;
import java.util.HashMap;
import java.util.Map;

/** Shared native design primitives matching the approved mobile screens. */
final class ArenaDesign {
    static final int PAPER=0xffa0d3d7, INK=0xff25282e, MUTED=0xff36565b,
        LINE=0xff7ab9c1, BRAND=0xff8f3026, PANEL=0xffffffff,
        GREEN=0xff28573f, GREEN_WASH=0xffe5ede2, RED=0xff972a21, RED_WASH=0xfff7e4de;
    private static final Map<String,Typeface> fonts=new HashMap<>();
    private static final Map<String,Bitmap> images=new HashMap<>();
    static Typeface font(Context c,String name){
        if(!fonts.containsKey(name))fonts.put(name,Typeface.createFromAsset(c.getAssets(),"fonts/"+name+".ttf"));
        return fonts.get(name);
    }
    static int poster(String game){return switch(game){
        case "word" -> 0xffaacee5;case "memory" -> 0xffcebbdf;case "math" -> 0xffd9e8a9;
        case "colors" -> 0xffefcf7b;case "mixed", "trivia" -> 0xffb6d0b6;default -> 0xfff0b19e;
    };}
    static String title(String game){return switch(game){
        case "word" -> "Harf Harmanı";case "memory" -> "Hafıza İzi";case "math" -> "Eksik Sayı";
        case "colors" -> "Renk Avı";case "mixed"->"Karma Arena";case "trivia" -> "Bilgi Arenası";default -> "Ters Köşe";
    };}
    static ImageView art(Context c,String game){
        String key=game.equals("word")?"anagram":game;
        if(!images.containsKey(key))try(var input=c.getAssets().open("art/"+key+".png")){images.put(key,BitmapFactory.decodeStream(input));}catch(Exception ignored){}
        ImageView view=new ImageView(c);view.setImageBitmap(images.get(key));view.setScaleType(ImageView.ScaleType.FIT_CENTER);
        if(key.equals("avatar")){android.graphics.drawable.GradientDrawable circle=new android.graphics.drawable.GradientDrawable();circle.setShape(android.graphics.drawable.GradientDrawable.OVAL);circle.setColor(0xff6a9d80);view.setBackground(circle);view.setClipToOutline(true);}
        view.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);return view;
    }
    static final class Icon extends View {
        final String name;final Paint p=new Paint(3);final int color;
        Icon(Context c,String name,int color){super(c);this.name=name;this.color=color;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
        void path(Canvas c,float... points){Path x=new Path();x.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)x.lineTo(points[i],points[i+1]);c.drawPath(x,p);}
        @Override protected void onDraw(Canvas c){
            super.onDraw(c);c.save();float scale=Math.min(getWidth(),getHeight())/24f;c.translate((getWidth()-24*scale)/2,(getHeight()-24*scale)/2);c.scale(scale,scale);
            p.setColor(color);p.setStrokeWidth(1.6f);p.setStrokeCap(Paint.Cap.ROUND);p.setStrokeJoin(Paint.Join.ROUND);p.setStyle(Paint.Style.STROKE);
            switch(name){
                case "home":path(c,3,10,12,3,21,10,21,21,14.5f,21,14.5f,14,9.5f,14,9.5f,21,3,21,3,10);break;
                case "games":c.drawRoundRect(3,6,21,19,5,5,p);path(c,6,12,12,12);path(c,9,9,9,15);c.drawCircle(16,11,.7f,p);c.drawCircle(18,14,.7f,p);break;
                case "ranking":case "prize":path(c,7,3,17,3,17,10,15,14,9,14,7,10,7,3);path(c,7,5,3,5,3,9,7,11);path(c,17,5,21,5,21,9,17,11);path(c,12,14,12,21);path(c,8,21,16,21);break;
                case "earnings":c.drawRoundRect(3,5,21,21,2,2,p);path(c,3,8,17,8);c.drawRoundRect(14,11,22,16,1,1,p);c.drawCircle(17,13.5f,.4f,p);break;
                case "profile":c.drawCircle(12,7,4,p);c.drawArc(4,12,20,27,180,180,false,p);break;
                case "bell":path(c,5,17,7,14,7,8,9,4,15,4,17,8,17,14,19,17,5,17);c.drawArc(10,18,14,22,0,180,false,p);break;
                case "back":path(c,20,12,4,12,10,6);path(c,4,12,10,18);break;
                case "check":path(c,4,12,9,17,20,6);break;
                case "settings":c.drawCircle(12,12,4,p);c.drawCircle(12,12,9,p);path(c,12,1,12,4);path(c,12,20,12,23);path(c,1,12,4,12);path(c,20,12,23,12);break;
                case "history":c.drawCircle(12,12,9,p);path(c,12,6,12,12,16,15);break;
                case "help":c.drawCircle(12,12,9,p);c.drawArc(8,6,16,13,180,240,false,p);path(c,12,12,12,14);c.drawPoint(12,18,p);break;
                default:path(c,5,12,19,12,14,7);path(c,19,12,14,17);
            }
            c.restore();
        }
    }

    /** Only the player's selection is shown before the common deadline. */
    static final class Scene extends View {
        boolean choiceStage=true;final Paint p=new Paint(3);final boolean reduced;final int selected;final boolean reveal,correct;
        final long started=SystemClock.elapsedRealtime();
        Scene(Context c,int selected,boolean reveal,boolean correct,boolean reduced){
            super(c);this.selected=selected;this.reveal=reveal;this.correct=correct;this.reduced=reduced;
            setContentDescription(reveal?"Süre kapandı. Cevaplar açıldı.":"Seçimler gizli. Yalnızca kendi seçimini görürsün.");
            setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_YES);
        }
        void fill(Canvas c,int color,float... xy){p.setStyle(Paint.Style.FILL);p.setColor(color);Path x=new Path();x.moveTo(xy[0],xy[1]);for(int i=2;i<xy.length;i+=2)x.lineTo(xy[i],xy[i+1]);x.close();c.drawPath(x,p);}
        void figure(Canvas c,float x,float y,int shirt,float size){
            c.save();c.translate(x,y);c.scale(size,size);p.setColor(0xff8ca98e);c.drawOval(-8,1,8,6,p);
            p.setColor(INK);c.drawRoundRect(-5,-4,-1,4,1,1,p);c.drawRoundRect(1,-4,5,4,1,1,p);
            p.setColor(shirt);c.drawRoundRect(-7,-22,7,-3,4,4,p);p.setColor(0xffe8b290);c.drawRoundRect(-6,-36,6,-22,5,5,p);
            p.setColor(INK);c.drawRoundRect(-7,-38,7,-32,3,3,p);c.drawCircle(-2,-29,1,p);c.drawCircle(2,-29,1,p);c.restore();
        }
        @Override protected void onDraw(Canvas c){
            super.onDraw(c);float s=Math.min(getWidth()/440f,getHeight()/290f);c.save();c.translate((getWidth()-440*s)/2,0);c.scale(s,s);p.setColor(0xffe6ecdc);c.drawRoundRect(0,0,440,290,20,20,p);

            fill(c,0xffc7d6bd,0,130,220,45,440,130,440,290,0,290);
            float[][] xy={{116,104},{324,104},{116,218},{324,218}};int[] colors={0xffe5eaf7,0xffe5ede2,0xfff2e1cc,0xfff0e3eb};
            p.setTypeface(font(getContext(),"rubik-500"));p.setTextAlign(Paint.Align.CENTER);
            for(int i=0;i<(choiceStage?4:0);i++){
                float x=xy[i][0],y=xy[i][1];fill(c,0xff8ca98e,x-76,y,x,y+40,x+76,y,x+76,y+14,x,y+54,x-76,y+14);
                fill(c,colors[i],x,y-36,x+76,y,x,y+40,x-76,y);
                p.setColor(INK);p.setTextSize(16);c.drawText(""+(char)('A'+i),x,y+23,p);

            }
            float progress=reduced?1:Math.min(1,(SystemClock.elapsedRealtime()-started)/500f);
            float x=220,y=156;if(choiceStage&&selected>=0){x+=(xy[selected][0]-x)*progress;y+=(xy[selected][1]-10-y)*progress-(float)Math.sin(progress*Math.PI)*25;}
            if(reveal&&!correct)y+=reduced?150:progress*150;
            if(y<280){figure(c,x,y,0xffde634a,1.5f);p.setColor(INK);p.setTextSize(13);c.drawText("Sen",x,y-66,p);}
            p.setColor(PANEL);c.drawRoundRect(158,39,282,63,6,6,p);p.setColor(INK);p.setTextSize(13);c.drawText(reveal?"Süre kapandı":choiceStage?"Gizli seçim":"Ortak aşama",220,56,p);c.restore();
            if(progress<1&&!reduced)postInvalidateDelayed(25);
        }
    }
}
