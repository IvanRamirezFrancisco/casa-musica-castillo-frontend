import { FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';
import { SanitizationService } from '../../services/sanitization.service';

describe('LoginComponent coordinated 2FA contract',()=>{
  let component: LoginComponent;
  let auth: jasmine.SpyObj<AuthService>;
  beforeEach(()=>{
    auth=jasmine.createSpyObj<AuthService>('auth',['login','sendTwoFactorCode','verifyTwoFactor','clearPendingLogin','completeLogin','redirectAfterLogin']);
    const sanitizer={sanitizeUserInput:(value:string)=>value,isValidEmail:()=>true} as unknown as SanitizationService;
    component=new LoginComponent(new FormBuilder(),auth,sanitizer,{navigate:()=>{}} as unknown as Router,
      {queryParams:of({})} as unknown as ActivatedRoute,{} as HttpClient);
    component.loginForm.setValue({email:'synthetic@example.invalid',password:'Synthetic!Password123'});
    auth.login.and.returnValue(of({twoFactorRequired:true,availableMethods:{EMAIL:true,GOOGLE_AUTHENTICATOR:true,BACKUP_CODE:true}}));
  });
  it('uses allowed methods without receiving or displaying a challenge',()=>{
    component.onSubmit();expect(component.showTwoFactorForm).toBeTrue();expect(component.availableMethods.length).toBe(2);
    expect(component.backupCodesAvailable).toBeTrue();expect(component.loginForm.value.password).toBe('');
    expect((component as unknown as Record<string,unknown>)['preAuthChallenge']).toBeUndefined();
  });
  it('send delegates identity resolution to AuthService',()=>{
    component.onSubmit();component.selectedMethod='EMAIL';auth.sendTwoFactorCode.and.returnValue(of({success:true,message:'Sent'}));
    component.sendVerificationCode();expect(auth.sendTwoFactorCode).toHaveBeenCalledOnceWith('EMAIL');
  });
  it('verify supplies factor only, with no email or client user id',()=>{
    component.onSubmit();component.selectedMethod='EMAIL';component.twoFactorCode='123456';
    auth.verifyTwoFactor.and.returnValue(of({success:true,message:'Verified'}));component.verifyTwoFactor();
    expect(auth.verifyTwoFactor).toHaveBeenCalledOnceWith({code:'123456',method:'EMAIL'});
  });
  it('cancel clears service state and UI fields',()=>{
    component.onSubmit();component.cancelTwoFactor();expect(auth.clearPendingLogin).toHaveBeenCalled();
    expect(component.showTwoFactorForm).toBeFalse();expect(component.pendingUser).toBeNull();expect(component.twoFactorCode).toBe('');
  });
  it('leaving the component clears memory state',()=>{
    component.ngOnDestroy();expect(auth.clearPendingLogin).toHaveBeenCalled();
  });
  it('rejected challenge resets flow and displays fixed plain text',()=>{
    component.onSubmit();component.selectedMethod='EMAIL';component.twoFactorCode='123456';
    auth.verifyTwoFactor.and.returnValue(throwError(()=>({status:401,error:{message:'<script>SyntheticSensitive</script>'}})));
    component.verifyTwoFactor();expect(component.showTwoFactorForm).toBeFalse();expect(component.errorMessage).not.toContain('SyntheticSensitive');
    expect(auth.clearPendingLogin).toHaveBeenCalled();
  });
  it('shows a controlled 429 fallback without requiring remainingTimeSeconds',()=>{
    auth.login.and.returnValue(throwError(()=>({status:429,error:{message:'SyntheticInternalDetail'}})));
    component.onSubmit();
    expect(component.errorMessage).toBe('Demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.');
    expect(component.errorMessage).not.toContain('SyntheticInternalDetail');
    expect(component.errorMessage).not.toContain('inesperado');
    expect(component.isLoading).toBeFalse();
  });

});
