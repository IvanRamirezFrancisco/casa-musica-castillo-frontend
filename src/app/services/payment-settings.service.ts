import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BankTransferSettingsRequest {
  bankName: string;
  accountHolder: string;
  clabe: string;
  accountNumber?: string | null;
  referenceInstructions?: string | null;
  additionalInstructions?: string | null;
  active: boolean;
}

export interface BankTransferSettingsResponse extends BankTransferSettingsRequest {
  id: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentSettingsService {
  private apiUrl = `${environment.apiUrl}/admin/payment-settings/bank-transfer`;

  constructor(private http: HttpClient) {}

  getBankTransferSettings(): Observable<BankTransferSettingsResponse> {
    return this.http.get<BankTransferSettingsResponse>(this.apiUrl);
  }

  updateBankTransferSettings(settings: BankTransferSettingsRequest): Observable<BankTransferSettingsResponse> {
    return this.http.put<BankTransferSettingsResponse>(this.apiUrl, settings);
  }
}
