import { useForm, SubmitHandler } from 'react-hook-form';
import { Options } from '../../types.ts';

interface OptionsFormProps {
  initialOptions?: Omit<Options, 'accessToken'> | null;
}

export default function OptionsForm({ initialOptions }: OptionsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Options>({
    defaultValues: { ...initialOptions, accessToken: '' },
  });
  const onSubmit: SubmitHandler<Options> = (options) =>
    chrome.storage.local.set({ options });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor={'url'}>Instance URL</label>
      <input
        id={'url'}
        {...register('url', {
          required: 'URL is required',
          validate: (value: string) => {
            try {
              const u = new URL(value);
              if (u.protocol === 'ws:' || u.protocol === 'wss:') return true;
              return 'URL must start with ws:// or wss://';
            } catch {
              return 'Invalid URL';
            }
          },
        })}
        placeholder={'wss://your-url.example'}
      />
      {errors.url && <p role="alert">{errors.url.message}</p>}

      <label htmlFor={'accessToken'}>Long Lived Access Token</label>
      <input
        id={'accessToken'}
        type={'password'}
        {...register('accessToken', { required: 'Access token is required' })}
      />
      {errors.accessToken && <p role="alert">{errors.accessToken.message}</p>}

      <label htmlFor={'deviceId'}>Device ID</label>
      <input
        id={'deviceId'}
        placeholder={'my_device_id'}
        {...register('deviceId', {
          required: 'Device ID is required',
          pattern: {
            value: /^[A-Za-z0-9_-]+$/,
            message:
              'Device ID may contain letters, numbers, underscores and hyphens only',
          },
        })}
      />
      {errors.deviceId && <p role="alert">{errors.deviceId.message}</p>}

      <hr />

      <input type="submit" />
    </form>
  );
}
