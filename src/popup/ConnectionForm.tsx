import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { Options } from '../types.ts';
import { NormalizeUrl } from '../utils.ts';
import { Icon } from './icons.tsx';
import { openTab } from './hooks.ts';

interface ConnectionFormProps {
  options: Options | null;
  onDone?: () => void;
}

export default function ConnectionForm({
  options,
  onDone,
}: ConnectionFormProps) {
  const [showToken, setShowToken] = useState(false);
  const hasToken = !!options?.accessToken;
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Options>({
    defaultValues: {
      url: options?.url ? (NormalizeUrl(options.url) ?? options.url) : '',
      accessToken: '',
    },
  });

  const baseUrl = NormalizeUrl(watch('url') ?? '');

  const onSubmit: SubmitHandler<Options> = async ({ url, accessToken }) => {
    await chrome.storage.local.set({
      options: {
        url: NormalizeUrl(url)!,
        accessToken: accessToken.trim() || options!.accessToken,
      },
    });
    onDone?.();
  };

  return (
    <form className="stack" onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <h2>{onDone ? 'Connection' : 'Connect to Home Assistant'}</h2>
        {!onDone && (
          <p className="muted">
            Once connected, this browser shows up in Home Assistant and you can
            add it with one click.
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="url">Home Assistant URL</label>
        <input
          id="url"
          autoFocus={!options?.url}
          placeholder="http://homeassistant.local:8123"
          autoComplete="url"
          spellCheck={false}
          aria-invalid={!!errors.url}
          {...register('url', {
            required: 'Enter the address of your Home Assistant',
            validate: (value) =>
              NormalizeUrl(value) !== null ||
              'That does not look like a valid address',
          })}
        />
        {errors.url ? (
          <p className="error" role="alert">
            {errors.url.message}
          </p>
        ) : (
          <p className="hint">The address you open Home Assistant with.</p>
        )}
      </div>

      <div className="field">
        <label htmlFor="accessToken">Long-lived access token</label>
        <div className="input-group">
          <input
            id="accessToken"
            type={showToken ? 'text' : 'password'}
            autoFocus={!!options?.url && !hasToken}
            placeholder={
              hasToken ? 'Leave empty to keep the current token' : ''
            }
            spellCheck={false}
            autoComplete="off"
            aria-invalid={!!errors.accessToken}
            {...register('accessToken', {
              validate: (value) =>
                hasToken ||
                value.trim().length > 0 ||
                'An access token is required',
            })}
          />
          <button
            type="button"
            className="icon-button"
            title={showToken ? 'Hide token' : 'Show token'}
            aria-pressed={showToken}
            onClick={() => setShowToken(!showToken)}
          >
            <Icon name="eye" size={18} />
          </button>
        </div>
        {errors.accessToken ? (
          <p className="error" role="alert">
            {errors.accessToken.message}
          </p>
        ) : (
          <p className="hint">
            Create one in your{' '}
            {baseUrl ? (
              <a
                href={`${baseUrl}/profile/security`}
                onClick={(e) => {
                  e.preventDefault();
                  openTab(`${baseUrl}/profile/security`);
                }}
              >
                Home Assistant profile → Security
              </a>
            ) : (
              'Home Assistant profile → Security'
            )}
            , at the very bottom.
          </p>
        )}
      </div>

      <div className="actions">
        {onDone && (
          <button type="button" className="button" onClick={onDone}>
            Cancel
          </button>
        )}
        <button type="submit" className="button primary">
          {onDone ? 'Save' : 'Connect'}
        </button>
      </div>
    </form>
  );
}
