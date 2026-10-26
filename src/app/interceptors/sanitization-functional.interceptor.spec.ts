import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { sanitizationInterceptor } from './sanitization-functional.interceptor';
import { SanitizationService } from '../services/sanitization.service';

describe('Auth opaque fields in sanitization interceptor',()=>{
  it('normalizes key matching without changing access/refresh/challenge payload values',()=>{
    const sanitizer=jasmine.createSpyObj<SanitizationService>('sanitizer',['sanitizeText']);
    sanitizer.sanitizeText.and.returnValue('sanitized text');
    TestBed.configureTestingModule({providers:[{provide:SanitizationService,useValue:sanitizer}]});
    const original={accessToken:'SyntheticAccess<opaque>',refreshToken:'SyntheticRefresh<opaque>',preAuthChallenge:'SyntheticChallenge<opaque>',message:'untrusted text'};
    TestBed.runInInjectionContext(()=>sanitizationInterceptor(new HttpRequest('GET','/synthetic-auth-test'),
      ()=>of(new HttpResponse({body:original})))).subscribe(event=>{
        if(event instanceof HttpResponse) {
          const body=event.body as Record<string,string>;
          expect(body['accessToken']).toBe(original.accessToken);
          expect(body['refreshToken']).toBe(original.refreshToken);
          expect(body['preAuthChallenge']).toBe(original.preAuthChallenge);
          expect(body['message']).toBe('sanitized text');
        }
      });
    expect(sanitizer.sanitizeText).toHaveBeenCalledOnceWith('untrusted text');
  });
});
