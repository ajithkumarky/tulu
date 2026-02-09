import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface Sentence {
  id: number;
  tulu_word: string;
  english_translation: string;
  image_name: string | null;
  tulu_sentence_roman: string | null;
  sentence_english_translation: string | null;
  sentence_status: string;
  sentence_notes: string | null;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'needs_correction';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  needs_correction: 'Needs Correction',
};

const AdminScreen = () => {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [editState, setEditState] = useState<Record<number, Partial<Sentence>>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  const fetchSentences = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString() });
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/admin/sentences?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` } as HeadersInit,
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      if (response.status === 403) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setSentences(data.sentences);
      setTotal(data.total);
      setPageSize(data.pageSize);
      setEditState({});
    } catch (error) {
      console.error('Error fetching sentences:', error);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, navigate]);

  useEffect(() => {
    fetchSentences();
  }, [fetchSentences]);

  const handleEditChange = (id: number, field: keyof Sentence, value: string) => {
    setEditState(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const getEditedValue = (sentence: Sentence, field: keyof Sentence): string => {
    const edited = editState[sentence.id];
    if (edited && field in edited) return (edited[field] as string) ?? '';
    return (sentence[field] as string) ?? '';
  };

  const saveSentence = async (id: number, extraFields?: Partial<Sentence>) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const edits = { ...editState[id], ...extraFields };
    if (Object.keys(edits).length === 0) return;

    setSavingIds(prev => new Set(prev).add(id));
    try {
      const response = await fetch(`/api/admin/sentences/${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        } as HeadersInit,
        body: JSON.stringify(edits),
      });

      if (response.ok) {
        const data = await response.json();
        setSentences(prev => prev.map(s => s.id === id ? data.sentence : s));
        setEditState(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    } catch (error) {
      console.error('Error saving sentence:', error);
    } finally {
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  if (accessDenied) {
    return (
      <Container>
        <Header>Access Denied</Header>
        <Message>You do not have permission to access this page.</Message>
        <BackLink onClick={() => navigate('/')}>Return to Home</BackLink>
      </Container>
    );
  }

  return (
    <Container>
      <TopBar>
        <Header>Sentence Review</Header>
        <BackLink onClick={() => navigate('/')}>Back to Home</BackLink>
      </TopBar>

      <FilterBar>
        {(['all', 'pending', 'approved', 'needs_correction'] as StatusFilter[]).map(s => (
          <FilterButton
            key={s}
            $active={statusFilter === s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </FilterButton>
        ))}
      </FilterBar>

      <Stats>
        Showing page {page} of {totalPages} ({total} total entries)
      </Stats>

      {loading ? (
        <Message>Loading sentences...</Message>
      ) : sentences.length === 0 ? (
        <Message>No sentences found for this filter.</Message>
      ) : (
        <CardList>
          {sentences.map(sentence => {
            const isSaving = savingIds.has(sentence.id);
            const currentStatus = getEditedValue(sentence, 'sentence_status') || sentence.sentence_status || 'pending';
            return (
              <Card key={sentence.id}>
                <CardHeader>
                  <WordInfo>
                    <IdBadge>#{sentence.id}</IdBadge>
                    <TuluWord>{sentence.tulu_word}</TuluWord>
                    <EnglishWord>{sentence.english_translation}</EnglishWord>
                  </WordInfo>
                  <StatusBadge $status={currentStatus}>
                    {STATUS_LABELS[currentStatus] || currentStatus}
                  </StatusBadge>
                </CardHeader>

                {sentence.image_name && (
                  <Thumbnail src={`/images/${sentence.image_name}`} alt={sentence.tulu_word} />
                )}

                <FieldGroup>
                  <Label>Tulu Sentence (Roman)</Label>
                  <TextArea
                    rows={2}
                    value={getEditedValue(sentence, 'tulu_sentence_roman')}
                    onChange={e => handleEditChange(sentence.id, 'tulu_sentence_roman', e.target.value)}
                    placeholder="No sentence yet..."
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label>English Translation</Label>
                  <TextArea
                    rows={2}
                    value={getEditedValue(sentence, 'sentence_english_translation')}
                    onChange={e => handleEditChange(sentence.id, 'sentence_english_translation', e.target.value)}
                    placeholder="No translation yet..."
                  />
                </FieldGroup>

                <FieldGroup>
                  <Label>Notes</Label>
                  <TextArea
                    rows={2}
                    value={getEditedValue(sentence, 'sentence_notes')}
                    onChange={e => handleEditChange(sentence.id, 'sentence_notes', e.target.value)}
                    placeholder="Reviewer notes..."
                  />
                </FieldGroup>

                <ButtonRow>
                  <ActionButton
                    $variant="approve"
                    disabled={isSaving}
                    onClick={() => saveSentence(sentence.id, { sentence_status: 'approved' })}
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    $variant="flag"
                    disabled={isSaving}
                    onClick={() => saveSentence(sentence.id, { sentence_status: 'needs_correction' })}
                  >
                    Flag
                  </ActionButton>
                  <ActionButton
                    $variant="save"
                    disabled={isSaving}
                    onClick={() => saveSentence(sentence.id)}
                  >
                    {isSaving ? 'Saving...' : 'Save Edits'}
                  </ActionButton>
                </ButtonRow>
              </Card>
            );
          })}
        </CardList>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PageButton disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Prev
          </PageButton>
          <PageInfo>Page {page} / {totalPages}</PageInfo>
          <PageButton disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Next
          </PageButton>
        </Pagination>
      )}
    </Container>
  );
};

// --- Styled Components ---

const Container = styled.div`
  min-height: 100vh;
  background-image: url('/images/background.jpeg');
  background-size: cover;
  background-position: center;
  padding: 20px;
  color: #fff;
  text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.7);
`;

const TopBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 10px;
`;

const Header = styled.h1`
  font-family: 'Georgia', serif;
  color: #ffd700;
  font-size: 2em;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0;
`;

const BackLink = styled.button`
  background: none;
  border: 2px solid #ffd700;
  color: #ffd700;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Verdana', sans-serif;
  font-size: 0.9em;
  &:hover { background: rgba(255, 215, 0, 0.15); }
`;

const Message = styled.p`
  font-family: 'Verdana', sans-serif;
  font-size: 1.2em;
  text-align: center;
  color: #f0f8ff;
  margin-top: 40px;
`;

const FilterBar = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  border: 2px solid ${p => p.$active ? '#ffd700' : '#8b4513'};
  background: ${p => p.$active ? 'rgba(255, 215, 0, 0.25)' : 'rgba(0, 0, 0, 0.4)'};
  color: ${p => p.$active ? '#ffd700' : '#f5f5dc'};
  cursor: pointer;
  font-family: 'Verdana', sans-serif;
  font-size: 0.85em;
  font-weight: ${p => p.$active ? 'bold' : 'normal'};
  &:hover { background: rgba(255, 215, 0, 0.15); }
`;

const Stats = styled.div`
  font-family: 'Verdana', sans-serif;
  font-size: 0.85em;
  color: #ccc;
  margin-bottom: 16px;
`;

const CardList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Card = styled.div`
  background-color: rgba(0, 0, 0, 0.6);
  border: 2px solid #8b4513;
  border-radius: 12px;
  padding: 16px;
`;

const CardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
`;

const WordInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const IdBadge = styled.span`
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85em;
`;

const TuluWord = styled.span`
  font-family: 'Georgia', serif;
  font-size: 1.2em;
  color: #ffd700;
  font-weight: bold;
`;

const EnglishWord = styled.span`
  font-family: 'Verdana', sans-serif;
  font-size: 0.95em;
  color: #f0f8ff;
`;

const StatusBadge = styled.span<{ $status: string }>`
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.8em;
  font-weight: bold;
  font-family: 'Verdana', sans-serif;
  text-shadow: none;
  background: ${p => {
    if (p.$status === 'approved') return '#2e7d32';
    if (p.$status === 'needs_correction') return '#c62828';
    return '#757575';
  }};
  color: #fff;
`;

const Thumbnail = styled.img`
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #8b4513;
  margin-bottom: 12px;
`;

const FieldGroup = styled.div`
  margin-bottom: 10px;
`;

const Label = styled.label`
  display: block;
  font-family: 'Verdana', sans-serif;
  font-size: 0.8em;
  color: #ccc;
  margin-bottom: 4px;
  text-shadow: none;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #8b4513;
  background: rgba(0, 0, 0, 0.5);
  color: #f0f8ff;
  font-family: 'Verdana', sans-serif;
  font-size: 0.9em;
  resize: vertical;
  box-sizing: border-box;
  &:focus {
    outline: none;
    border-color: #ffd700;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
`;

const ActionButton = styled.button<{ $variant: 'approve' | 'flag' | 'save' }>`
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-family: 'Verdana', sans-serif;
  font-size: 0.85em;
  font-weight: bold;
  color: #fff;
  background: ${p => {
    if (p.$variant === 'approve') return '#2e7d32';
    if (p.$variant === 'flag') return '#c62828';
    return '#a0522d';
  }};
  &:hover {
    opacity: 0.85;
    transform: translateY(-1px);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
  padding-bottom: 24px;
`;

const PageButton = styled.button`
  padding: 8px 20px;
  border-radius: 6px;
  border: 2px solid #8b4513;
  background: rgba(0, 0, 0, 0.4);
  color: #f5f5dc;
  cursor: pointer;
  font-family: 'Verdana', sans-serif;
  font-size: 0.9em;
  &:hover:not(:disabled) { background: rgba(139, 69, 19, 0.5); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PageInfo = styled.span`
  font-family: 'Verdana', sans-serif;
  font-size: 0.9em;
  color: #f0f8ff;
`;

export default AdminScreen;
