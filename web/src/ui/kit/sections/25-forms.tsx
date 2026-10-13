import { useState } from 'react';
import { SearchField, Select, Slider, Switch, TextArea, TextField } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'forms', title: 'Forms', order: 25 };

export default function Forms() {
  const [instances, setInstances] = useState(3);
  const [cpu, setCpu] = useState(0.5);
  const [ram, setRam] = useState(2000);
  const [sound, setSound] = useState(false);
  const [name, setName] = useState('hello-flux');
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('eu');
  const [notes, setNotes] = useState('');
  return (
    <Group
      id="forms"
      title="Controls"
      lead="The slider is the control of this site: a hex thumb on a ticked rail with a mono readout, over a real range input so the keyboard, touch and assistive tech are native. Text fields share one chamfered frame with a mono label, hint and error."
    >
      <Sub>Slider</Sub>
      <Grid min={320}>
        <Spec label="Instances: marks, bubble while dragging">
          <Slider
            label="Instances"
            min={1}
            max={12}
            value={instances}
            onValueChange={setInstances}
            unit={instances === 1 ? 'instance' : 'instances'}
            marks={[{ value: 1 }, { value: 3, label: '3 min' }, { value: 12 }]}
            readout="both"
          />
        </Spec>
        <Spec label="CPU: 0.1 steps, formatted">
          <Slider
            label="CPU"
            min={0.1}
            max={2}
            step={0.1}
            value={cpu}
            onValueChange={setCpu}
            format={(n) => n.toFixed(1)}
            unit="vCPU"
            marks
          />
        </Spec>
        <Spec label="RAM: 100 steps (ticks thinned), lg, tier tint">
          <Slider
            label="RAM"
            min={100}
            max={8000}
            step={100}
            value={ram}
            onValueChange={setRam}
            format={(n) => (n / 1000).toFixed(1)}
            unit="GB"
            size="lg"
            tier="nimbus"
          />
        </Spec>
        <Spec label="Disabled">
          <Slider label="Disk" min={1} max={100} defaultValue={40} unit="GB" disabled />
        </Spec>
      </Grid>

      <Sub>Switch</Sub>
      <Row>
        <Switch checked={sound} onCheckedChange={setSound}>
          Sound
        </Switch>
        <Switch defaultChecked description="Plays after 120 s of stillness">
          Ambient mode
        </Switch>
        <Switch size="sm" defaultChecked>
          Small
        </Switch>
        <Switch disabled>Disabled</Switch>
        <Switch aria-label="No label" defaultChecked />
      </Row>

      <Sub>Text</Sub>
      <Grid min={280}>
        <Spec label="TextField with hint">
          <TextField
            label="App name"
            hint="3 to 32 lowercase letters, digits and dashes"
            value={name}
            onValueChange={setName}
          />
        </Spec>
        <Spec label="Error">
          <TextField
            label="Repository tag"
            defaultValue="nginx"
            error="Add a tag, for example nginx:1.27. latest changes without warning."
            mono
          />
        </Spec>
        <Spec label="Prefix and suffix, mono">
          <TextField label="Port" defaultValue="8080" prefix=":" suffix="TCP" mono />
        </Spec>
        <Spec label="Focus-visible (forced)">
          <TextField label="Domain" defaultValue="example.com" data-force="focus" />
        </Spec>
        <Spec label="Disabled">
          <TextField label="Owner" defaultValue="set at deploy time" disabled />
        </Spec>
        <Spec label="SearchField with shortcut">
          <SearchField
            value={query}
            onValueChange={setQuery}
            placeholder="Search lessons and terms"
            shortcut="/"
          />
        </Spec>
        <Spec label="Command prompt">
          <SearchField prompt=">" placeholder="Type a command" shortcut="mod+k" />
        </Spec>
        <Spec label="TextArea with counter">
          <TextArea
            label="Notes"
            value={notes}
            onValueChange={setNotes}
            maxLength={120}
            autoGrow
            rows={3}
            hint="Auto-grows to 12 rows"
          />
        </Spec>
      </Grid>

      <Sub>Select</Sub>
      <Grid min={280}>
        <Spec label="Native select, custom frame">
          <Select
            label="Region"
            value={region}
            onValueChange={setRegion}
            options={[
              { value: 'eu', label: 'Europe', group: 'Continents' },
              { value: 'na', label: 'North America', group: 'Continents' },
              { value: 'as', label: 'Asia', group: 'Continents' },
              { value: 'de', label: 'Germany', group: 'Countries' },
            ]}
          />
        </Spec>
        <Spec label="Placeholder, error">
          <Select
            label="Instance count"
            placeholder="Choose"
            options={[
              { value: '1', label: '1 instance' },
              { value: '3', label: '3 instances' },
            ]}
            error="Pick at least 3 for a production app"
          />
        </Spec>
      </Grid>
      <Col>
        <span className="t-small">Tab through this section: every control has a visible focus state.</span>
      </Col>
    </Group>
  );
}
