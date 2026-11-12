package com.bilgiarena.app;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;

/** Local exercises only. These scores and bundled answers never enter the weekly league. */
public final class PracticeRound {
    public static final long QUESTION_MS = 15_000;
    public record Question(String category, String prompt, List<String> options, String letters,
                           String answer, String explanation, String kind, int seconds,
                           List<Integer> sequence, String ink) {
        public Question(String category,String prompt,List<String> options,String letters,String answer,String explanation){
            this(category,prompt,options,letters,answer,explanation,options.isEmpty()?"word":"choice",prompt.length()>65?15:10,List.of(),"");
        }
    }
    public record Feedback(boolean correct, boolean timedOut, boolean interrupted, String answer,
                           String explanation, int points) {}
    private static final Locale TURKISH = Locale.forLanguageTag("tr-TR");
    private final List<Question> questions;
    public final String game;
    public int index, score, correct;
    private long started;
    private Feedback feedback;
    private boolean accessible;

    public PracticeRound(String game,long seed,long elapsedNow){this(game,seed,elapsedNow,Set.of());}
    public PracticeRound(String game, long seed, long elapsedNow,Set<String> recent) {
        if (!List.of("trivia", "word", "math", "reverse", "memory", "colors").contains(game)) throw new IllegalArgumentException("game");
        this.game = game;
        Random random = new Random(seed);
        questions = create(game, random,recent);
        started = elapsedNow;
    }
    public Question question() { return questions.get(index); }
    public Feedback feedback() { return feedback; }
    public void accessible(boolean value){accessible=value;}
    public long duration() { return accessible&&question().kind().equals("memory")?30000:question().seconds()*1000L; }
    public long elapsed(long now) { return Math.max(0,now-started); }
    public long remaining(long now) { return Math.max(0, duration() - (now - started)); }
    public boolean complete() { return index == questions.size() - 1 && feedback != null; }
    public boolean waiting() { return feedback == null; }
    public Feedback answer(String value, long now) { return resolve(value, now, false); }
    public Feedback interrupt(long now) { return resolve(null, now, true); }
    private Feedback resolve(String value, long now, boolean interrupted) {
        if (feedback != null) return feedback;
        boolean timedOut = now - started >= duration();
        Question q = question();
        boolean matches=q.kind().equals("number")?value!=null&&value.matches("\\d{1,4}")&&Integer.parseInt(value)==Integer.parseInt(q.answer()):normalize(value).equals(normalize(q.answer()));
        boolean ok = !timedOut && !interrupted && matches;
        if (ok) { score += 10; correct++; }
        feedback = new Feedback(ok, timedOut, interrupted, q.answer(), q.explanation(), ok ? 10 : 0);
        return feedback;
    }
    public void next(long now) {
        if (feedback == null || complete()) return;
        index++; feedback = null; started = now;
    }
    public static String normalize(String s) {
        return s == null ? "" : java.text.Normalizer.normalize(s.trim().toLowerCase(TURKISH), java.text.Normalizer.Form.NFC);
    }
    public static String fingerprint(Question q){return q.kind().equals("word")?"word:"+normalize(q.answer()):"question:"+normalize(q.prompt());}
    public List<String> fingerprints(){return questions.stream().map(PracticeRound::fingerprint).toList();}
    private static List<Question> create(String game, Random r,Set<String> recent) {
        List<Question> pool = new ArrayList<>();
        if(game.equals("memory")){
            for(int i=0;i<10;i++){
                List<Integer> pads=new ArrayList<>();for(int n=0;n<9;n++)pads.add(n);Collections.shuffle(pads,r);
                List<Integer> seq=List.copyOf(pads.subList(0,3+i/4));
                String answer=seq.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
                String shown=seq.stream().map(n->String.valueOf(n+1)).collect(java.util.stream.Collectors.joining(" → "));
                pool.add(new Question("Hafıza İzi","Işıkları izle, aynı sırayla dokun.",List.of(),"",answer,"Doğru sıra: "+shown+".","memory",seq.size()>3?15:10,seq,""));
            }
        }else if(game.equals("colors")){
            String[] names={"Mavi","Kırmızı","Yeşil","Turuncu"},tones={"blue","red","green","orange"};
            for(int i=0;i<10;i++){
                int answer=r.nextInt(4),word=(answer+1+r.nextInt(3))%4;
                pool.add(new Question("Renk Avı",names[word].toUpperCase(TURKISH),List.of(names),"",names[answer],"Yazının rengi: "+names[answer]+".","colors",10,List.of(),tones[answer]));
            }
        }else if (game.equals("math")) {
            for (int i = 0; i < 10; i++) {
                int a=3+r.nextInt(19),b=2+r.nextInt(12),op=i%4;
                String prompt=op==0?a+" + ? = "+(a+b):op==1?a+" × ? = "+(a*b):op==2?"? ÷ "+b+" = "+a:"("+a+" × 2) + "+b+" = ?";
                String answer=String.valueOf(op==2?a*b:op==3?a*2+b:b);
                pool.add(new Question("Eksik Sayı",prompt,List.of(),"",answer,"Eksik sayı: "+answer+".","number",op==0?10:15,List.of(),""));
            }
        } else if (game.equals("word")||game.equals("reverse")) {
            String[][] words = BundledContent.WORDS;
            for (String[] w : words) {
                List<String> letters = new ArrayList<>(); for (char c : w[0].toCharArray()) letters.add(""+c);
                Collections.shuffle(letters, r);
                if (String.join("", letters).equals(w[0])) Collections.rotate(letters, 1);
                String shown=game.equals("reverse")?new StringBuilder(w[0]).reverse().toString():String.join("",letters);
                pool.add(new Question(game.equals("reverse")?"Ters Köşe":"Harf Harmanı",game.equals("reverse")?"Tersten yazılan kelimeyi bul.":w[1],List.of(),shown,w[0],"Aradığımız kelime: "+w[0]+".","word",w[0].length()>7?15:10,List.of(),""));
            }
        } else {
            String[][] samples = BundledContent.TRIVIA;
            for (String[] s : samples) {
                List<String> choices = new ArrayList<>(List.of(s[2],s[3],s[4],s[5])); Collections.shuffle(choices,r);
                pool.add(new Question(s[0],s[1],choices,"",s[2],s[6]));
            }
        }
        Collections.shuffle(pool, r);
        if(List.of("trivia","word","reverse").contains(game))pool.sort(java.util.Comparator.comparing(q->recent.contains(fingerprint(q))));
        return List.copyOf(pool.subList(0,10));
    }
}
