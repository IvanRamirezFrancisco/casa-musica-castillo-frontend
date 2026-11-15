import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ConnectivityService } from './connectivity.service';

export type VoiceSearchStatus =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RECOGNIZED'
  | 'NO_SPEECH'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED'
  | 'OFFLINE'
  | 'ERROR';

export interface VoiceSearchEvent {
  status: VoiceSearchStatus;
  transcript: string;
  isFinal: boolean;
  message?: string;
  sourceId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class VoiceSearchService implements OnDestroy {
  private recognition: any = null;
  private isSupportedFlag = false;
  private activeSourceId: string | undefined;
  private latestTranscript = '';
  private routerSub?: Subscription;
  private resetTimer: any = null;

  private stateSubject = new BehaviorSubject<VoiceSearchEvent>({
    status: 'IDLE',
    transcript: '',
    isFinal: false,
  });

  private transcriptSubject = new Subject<{
    transcript: string;
    isFinal: boolean;
    sourceId?: string;
  }>();

  public readonly state$: Observable<VoiceSearchEvent> =
    this.stateSubject.asObservable();
  public readonly transcript$: Observable<{
    transcript: string;
    isFinal: boolean;
    sourceId?: string;
  }> = this.transcriptSubject.asObservable();

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private connectivityService: ConnectivityService
  ) {
    this.detectSupport();

    // Detener el micrófono inmediatamente al cambiar de ruta
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => {
        if (this.isListening()) {
          this.stopListening();
        }
      });
  }

  private detectSupport(): void {
    if (typeof window === 'undefined') {
      this.isSupportedFlag = false;
      return;
    }
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    this.isSupportedFlag = typeof SpeechRecognitionCtor === 'function';
  }

  /**
   * Indica si el navegador actual soporta Web Speech API (SpeechRecognition / webkitSpeechRecognition).
   */
  isSupported(): boolean {
    return this.isSupportedFlag;
  }

  /**
   * Indica si actualmente hay una sesión de escucha activa.
   */
  isListening(sourceId?: string): boolean {
    const current = this.stateSubject.value.status;
    const active = current === 'LISTENING' || current === 'PROCESSING';
    if (!sourceId) {
      return active;
    }
    return active && this.activeSourceId === sourceId;
  }

  getCurrentState(): VoiceSearchEvent {
    return this.stateSubject.value;
  }

  /**
   * Inicia el reconocimiento de voz únicamente tras la acción explícita del usuario (clic en botón).
   * Nunca graba ni almacena audio crudo; sólo transcribe texto para el buscador.
   */
  startListening(sourceId = 'global'): void {
    this.clearResetTimer();

    if (!this.isSupportedFlag) {
      this.emitState({
        status: 'UNSUPPORTED',
        transcript: '',
        isFinal: false,
        message: 'La búsqueda por voz no está disponible en este navegador.',
        sourceId,
      });
      this.scheduleIdleReset(4500);
      return;
    }

    if (!this.connectivityService.isOnline) {
      this.emitState({
        status: 'OFFLINE',
        transcript: '',
        isFinal: false,
        message: 'Necesitas conexión a internet para usar la búsqueda por voz.',
        sourceId,
      });
      this.scheduleIdleReset(4500);
      return;
    }

    // Si ya estaba escuchando, detener instancia previa limpiamente
    this.abortRecognitionInstance();

    try {
      const SpeechRecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionCtor();

      recognition.lang = 'es-MX';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      this.recognition = recognition;
      this.activeSourceId = sourceId;
      this.latestTranscript = '';

      recognition.onstart = () => {
        this.ngZone.run(() => {
          this.emitState({
            status: 'LISTENING',
            transcript: '',
            isFinal: false,
            message: 'Escuchando... Di el instrumento, marca o modelo.',
            sourceId,
          });
        });
      };

      recognition.onresult = (event: any) => {
        this.ngZone.run(() => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result?.[0]?.transcript || '';
            if (result.isFinal) {
              finalTranscript += text;
            } else {
              interimTranscript += text;
            }
          }

          const combined = (finalTranscript || interimTranscript)
            .replace(/\s+/g, ' ')
            .trim();
          this.latestTranscript = combined;

          if (finalTranscript.trim().length > 0) {
            const cleanFinal = this.cleanVoiceTranscript(finalTranscript);
            this.emitState({
              status: 'RECOGNIZED',
              transcript: cleanFinal,
              isFinal: true,
              message: `Reconocido: "${cleanFinal}"`,
              sourceId,
            });
            this.transcriptSubject.next({
              transcript: cleanFinal,
              isFinal: true,
              sourceId,
            });
            this.stopRecognitionInstance();
            this.scheduleIdleReset(2500);
          } else if (combined.length > 0) {
            const cleanInterim = this.cleanVoiceTranscript(combined);
            this.emitState({
              status: 'PROCESSING',
              transcript: cleanInterim,
              isFinal: false,
              message: `Procesando: "${cleanInterim}"...`,
              sourceId,
            });
            this.transcriptSubject.next({
              transcript: cleanInterim,
              isFinal: false,
              sourceId,
            });
          }
        });
      };

      recognition.onerror = (event: any) => {
        this.ngZone.run(() => {
          const errorCode: string = event?.error || 'unknown';
          this.recognition = null;

          if (errorCode === 'aborted') {
            // Cancelado explícitamente por el usuario o cambio de vista
            return;
          }

          if (
            errorCode === 'not-allowed' ||
            errorCode === 'service-not-allowed'
          ) {
            this.emitState({
              status: 'PERMISSION_DENIED',
              transcript: '',
              isFinal: false,
              message:
                'No se pudo usar el micrófono. Puedes escribir tu búsqueda manualmente.',
              sourceId,
            });
          } else if (errorCode === 'no-speech') {
            this.emitState({
              status: 'NO_SPEECH',
              transcript: '',
              isFinal: false,
              message:
                'No detectamos tu voz. Intenta hablar más cerca del micrófono o escribe tu búsqueda.',
              sourceId,
            });
          } else if (errorCode === 'network') {
            this.emitState({
              status: 'OFFLINE',
              transcript: '',
              isFinal: false,
              message:
                'Error de red en el reconocimiento de voz. Puedes escribir tu búsqueda manualmente.',
              sourceId,
            });
          } else {
            this.emitState({
              status: 'ERROR',
              transcript: '',
              isFinal: false,
              message:
                'No pudimos procesar el audio. Puedes escribir tu búsqueda manualmente.',
              sourceId,
            });
          }

          this.scheduleIdleReset(5000);
        });
      };

      recognition.onend = () => {
        this.ngZone.run(() => {
          const currentState = this.stateSubject.value;
          this.recognition = null;

          // Si terminó en PROCESSING con texto parcial, entregarlo como resultado final
          if (
            currentState.status === 'PROCESSING' &&
            this.latestTranscript.trim().length > 0
          ) {
            const cleanText = this.cleanVoiceTranscript(this.latestTranscript);
            this.emitState({
              status: 'RECOGNIZED',
              transcript: cleanText,
              isFinal: true,
              message: `Reconocido: "${cleanText}"`,
              sourceId,
            });
            this.transcriptSubject.next({
              transcript: cleanText,
              isFinal: true,
              sourceId,
            });
            this.scheduleIdleReset(2500);
          } else if (currentState.status === 'LISTENING') {
            this.emitState({
              status: 'NO_SPEECH',
              transcript: '',
              isFinal: false,
              message:
                'No se detectó voz. Puedes intentar de nuevo o escribir tu búsqueda.',
              sourceId,
            });
            this.scheduleIdleReset(3500);
          }
        });
      };

      recognition.start();
    } catch {
      this.recognition = null;
      this.emitState({
        status: 'ERROR',
        transcript: '',
        isFinal: false,
        message:
          'No se pudo iniciar el micrófono. Puedes escribir tu búsqueda manualmente.',
        sourceId,
      });
      this.scheduleIdleReset(4500);
    }
  }

  /**
   * Alterna entre iniciar y detener la búsqueda por voz para un origen dado.
   */
  toggleListening(sourceId = 'global'): void {
    if (this.isListening(sourceId)) {
      this.stopListening(sourceId);
    } else {
      this.startListening(sourceId);
    }
  }

  /**
   * Detiene inmediatamente el reconocimiento activo y libera recursos.
   */
  stopListening(sourceId?: string): void {
    if (sourceId && this.activeSourceId && this.activeSourceId !== sourceId) {
      return;
    }
    this.clearResetTimer();
    this.abortRecognitionInstance();
    this.activeSourceId = undefined;
    this.latestTranscript = '';
    this.emitState({
      status: 'IDLE',
      transcript: '',
      isFinal: false,
    });
  }

  dismissMessage(): void {
    this.clearResetTimer();
    if (!this.isListening()) {
      this.emitState({
        status: 'IDLE',
        transcript: '',
        isFinal: false,
      });
    }
  }

  /**
   * Limpia signos de puntuación finales que suelen añadir los motores de dictado (ej. punto final).
   */
  private cleanVoiceTranscript(raw: string): string {
    return raw
      .replace(/[.,;!?¡¿]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
  }

  private stopRecognitionInstance(): void {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
      this.recognition = null;
    }
  }

  private abortRecognitionInstance(): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.onresult = null;
        this.recognition.abort();
      } catch {
        // Ignorar errores al abortar
      }
      this.recognition = null;
    }
  }

  private emitState(event: VoiceSearchEvent): void {
    this.stateSubject.next(event);
  }

  private scheduleIdleReset(ms: number): void {
    this.clearResetTimer();
    this.resetTimer = setTimeout(() => {
      this.ngZone.run(() => {
        if (!this.isListening()) {
          this.emitState({
            status: 'IDLE',
            transcript: '',
            isFinal: false,
          });
        }
      });
    }, ms);
  }

  private clearResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.stopListening();
    this.routerSub?.unsubscribe();
  }
}
