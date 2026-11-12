package com.bilgiarena.app;
import android.content.*;
import android.database.*;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import java.io.*;
/** Exposes only a deliberately generated, non-sensitive result card. */
public final class ResultShareProvider extends ContentProvider {
 public boolean onCreate(){return true;}
 private File file(Uri uri)throws FileNotFoundException{if(!"/result.png".equals(uri.getPath()))throw new FileNotFoundException();return new File(getContext().getCacheDir(),"shared-result.png");}
 @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException();return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 public String getType(Uri uri){return "image/png";}
 public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){MatrixCursor cursor=new MatrixCursor(new String[]{"_display_name","_size"});try{cursor.addRow(new Object[]{"BilgiArena-sonuc.png",file(uri).length()});}catch(IOException ignored){}return cursor;}
 public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException();}
 public int delete(Uri uri,String selection,String[] args){throw new UnsupportedOperationException();}
 public int update(Uri uri,ContentValues values,String selection,String[] args){throw new UnsupportedOperationException();}
}
