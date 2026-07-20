import { colors } from '../styles';

interface Props {
  isAuthenticated: boolean;
}

export default function SyncStatus({ isAuthenticated }: Props) {
  if (!isAuthenticated) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 16px 8px' }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: colors.green,
          display: 'inline-block',
        }}
      />
    </div>
  );
}
