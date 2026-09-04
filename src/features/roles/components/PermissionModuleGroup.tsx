/**
 * One collapsible module of the permission tree. Web renders all ~25
 * modules always-open in a 340px scroller; 89 checkboxes with no collapse
 * would be an unreasonably long scroll on a phone, so each module starts
 * collapsed and expands on tap — the header row (module checkbox + label +
 * count + chevron) stays visible either way, so the tri-state selection is
 * always readable without opening every group.
 */

import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '@/components/ui';
import { useAppTheme } from '@/theme/ThemeContext';

import { moduleSelectionState, moduleSlugs } from '../permissionSelection';
import type { PermissionModule } from '../roles.types';
import { CheckboxRow } from './CheckboxRow';

interface PermissionModuleGroupProps {
  group: PermissionModule;
  selected: readonly string[];
  disabled: boolean;
  onToggleModule: (slugs: string[], checked: boolean) => void;
  onTogglePermission: (slug: string, checked: boolean) => void;
  /** Open on first render — used to expand the one or two modules a role
   * already holds something in, so opening Edit doesn't present 25 closed
   * accordions hiding what the role actually has. */
  defaultExpanded?: boolean;
}

export function PermissionModuleGroup({ group, selected, disabled, onToggleModule, onTogglePermission, defaultExpanded = false }: PermissionModuleGroupProps) {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const slugs = moduleSlugs(group);
  const state = moduleSelectionState(selected, slugs);
  const heldCount = slugs.filter((slug) => selected.includes(slug)).length;

  return (
    <View style={[styles.wrapper, { borderColor: theme.colors.border }]}>
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <CheckboxRow
            label={group.label}
            state={state === 'all' ? 'checked' : state === 'partial' ? 'indeterminate' : 'unchecked'}
            onPress={() => !disabled && onToggleModule(slugs, state !== 'all')}
            disabled={disabled}
            emphasis
          />
        </View>
        <Text style={{ color: theme.colors.textMuted, fontFamily: theme.fontFamilies.body.regular, fontSize: 11, marginRight: 6 }}>
          {heldCount}/{slugs.length}
        </Text>
        <Icon name={expanded ? 'expand-less' : 'expand-more'} size={22} color={theme.colors.textMuted} />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.body, { borderTopColor: theme.colors.border }]}>
          {group.permissions.map((perm) => (
            <CheckboxRow
              key={perm.id}
              label={perm.label}
              caption={perm.slug}
              state={selected.includes(perm.slug) ? 'checked' : 'unchecked'}
              onPress={() => !disabled && onTogglePermission(perm.slug, !selected.includes(perm.slug))}
              disabled={disabled}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 2 },
  body: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingLeft: 32 },
});
