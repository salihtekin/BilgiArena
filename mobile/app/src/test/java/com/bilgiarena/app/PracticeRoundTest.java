package com.bilgiarena.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class PracticeRoundTest {
    @Test public void allGamesHaveTenValidQuestionsAndBoundedScoring() {
        for(String game:new String[]{"trivia","word","math","reverse","memory","colors"}){
            PracticeRound r=new PracticeRound(game,42,0);
            for(int i=0;i<10;i++){
                assertEquals(i,r.index);
                PracticeRound.Question q=r.question();
                assertFalse(q.prompt().isEmpty());
                if(!q.options().isEmpty()){assertEquals(4,new java.util.HashSet<>(q.options()).size());assertTrue(q.options().contains(q.answer()));}
                assertTrue(r.answer(q.answer(),i*2000L+1000).correct());
                r.answer(q.answer(),i*2000L+1100);assertEquals((i+1)*10,r.score);
                r.next(i*2000L+2000);
            }
            assertTrue(r.complete());assertEquals(100,r.score);assertEquals(10,r.correct);
        }
    }
    @Test public void timeoutUsesMonotonicTimeAndCannotBeRetriedForPoints(){
        PracticeRound r=new PracticeRound("math",20,1000);
        assertTrue(r.answer(r.question().answer(),26000).timedOut());assertEquals(0,r.score);
        assertFalse(r.answer(r.question().answer(),2000).correct());
        r.next(30000);assertEquals(r.duration(),r.remaining(30000));
    }
    @Test public void leavingInvalidatesOnlyTheCurrentQuestionAndDoesNotResetItsTimer(){
        PracticeRound r=new PracticeRound("word",5,1000);
        assertTrue(r.interrupt(2000).interrupted());assertFalse(r.answer(r.question().answer(),2100).correct());
        assertEquals(0,r.score);r.next(3000);assertEquals(1,r.index);assertTrue(r.answer(r.question().answer(),4000).correct());
        r.interrupt(5000);assertTrue(r.feedback().correct());assertEquals(10,r.score);
    }
    @Test public void turkishWordsNormalizeCorrectly(){assertEquals("ışık",PracticeRound.normalize(" IŞIK "));assertEquals("istanbul",PracticeRound.normalize("İSTANBUL"));}
}
